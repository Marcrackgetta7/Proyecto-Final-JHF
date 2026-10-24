"""DevStory AI — FastAPI entrypoint with multimodal generation and Supabase persistence."""

from datetime import datetime, timezone
import logging
import os
from typing import Any

from app.env_loader import load_backend_env
from fastapi import FastAPI, File, Form, Header, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.schemas import DevStoryOutput
from app.services.gemini_service import GeminiService
from app.services.supabase_service import RateLimitExceeded, SupabaseService

load_backend_env()
logger = logging.getLogger(__name__)

APP_VERSION = "0.2.0"
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "10"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

app = FastAPI(
    title="DevStory AI API",
    version=APP_VERSION,
    description="Multimodal (voice / text / sketch) to PRD, Jira stories, Mermaid and React code.",
)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://devstory.app")
allowed_origins = [origin.strip() for origin in _raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "HEAD", "OPTIONS"],
    allow_headers=["*"],
)

gemini_service = GeminiService()
supabase_service = SupabaseService()


def _resolve_user_id(user_id: str | None, authorization: str | None) -> str | None:
    """Extrae el user_id explícito o decodifica el token Bearer en Supabase."""
    if user_id and user_id.strip():
        return user_id.strip()
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        try:
            if supabase_service._client:
                user_res = supabase_service._client.auth.get_user(token)
                if user_res and user_res.user:
                    return user_res.user.id
        except Exception as e:
            logger.debug("No se pudo extraer usuario del Bearer token: %s", e)
    return None


class SaveProjectRequest(BaseModel):
    output: DevStoryOutput
    user_id: str | None = None
    project_name: str | None = None


class RefineRequest(BaseModel):
    instruction: str
    current_output: DevStoryOutput
    user_id: str | None = None
    project_id: str | None = None
    model_tier: str = "flash"


@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    """Ruta raíz de la API para verificación de estado y documentación."""
    return {
        "service": "DevStory AI API",
        "status": "online",
        "health": "/health",
        "docs": "/docs",
    }


@app.api_route("/health", methods=["GET", "HEAD"], tags=["system"])
async def health(response: Response) -> dict[str, str]:
    """Lightweight liveness probe for UptimeRobot (no DB / AI calls).

    FastAPI/Starlette strips the body automatically on HEAD requests.
    """
    response.headers["Cache-Control"] = "no-store"
    return {
        "status": "ok",
        "version": APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/api/generate", tags=["generation"])
async def generate(
    request: Request,
    prompt_text: str = Form(""),
    user_id: str | None = Form(None),
    project_id: str | None = Form(None),
    model_tier: str = Form("flash"),
    sketch: UploadFile | None = File(None),
    voice: UploadFile | None = File(None),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Genera PRD, backlog de Jira, diagrama Mermaid y componente React a partir de entradas multimodales.

    Modo Invitado: si no hay user_id autenticado, NO persiste en DB ni sube a Storage (100% efímero en memoria).
    """
    client_ip = request.client.host if request.client else None
    resolved_user = _resolve_user_id(user_id, authorization)

    # 1. Validar cuota mensual (Rate Limiting para plan Free) si está autenticado
    if resolved_user:
        try:
            supabase_service.check_rate_limit(user_id=resolved_user, ip_address=client_ip)
        except RateLimitExceeded as e:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=str(e),
            )

    # 2. Leer y validar archivos subidos (límite MAX_UPLOAD_MB)
    sketch_bytes: bytes | None = None
    sketch_mime: str | None = None
    if sketch:
        sketch_bytes = await sketch.read()
        if len(sketch_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"La imagen del boceto excede el límite máximo de {MAX_UPLOAD_MB}MB.",
            )
        sketch_mime = sketch.content_type or "image/png"

    voice_bytes: bytes | None = None
    voice_mime: str | None = None
    if voice:
        voice_bytes = await voice.read()
        if len(voice_bytes) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"El audio excede el límite máximo de {MAX_UPLOAD_MB}MB.",
            )
        voice_mime = voice.content_type or "audio/webm"

    # 3. Determinar tipo de entrada
    if sketch_bytes and voice_bytes:
        input_type = "mixed"
    elif sketch_bytes:
        input_type = "image"
    elif voice_bytes:
        input_type = "audio"
    else:
        input_type = "text"

    # 4. Almacenar archivos en Storage únicamente si el usuario está autenticado
    sketch_path: str | None = None
    audio_path: str | None = None
    if resolved_user:
        if sketch_bytes and sketch:
            sketch_path = supabase_service.upload_file(
                file_bytes=sketch_bytes,
                filename=sketch.filename or "boceto.png",
                content_type=sketch_mime or "image/png",
                user_id=resolved_user,
                project_id=project_id,
            )
        if voice_bytes and voice:
            audio_path = supabase_service.upload_file(
                file_bytes=voice_bytes,
                filename=voice.filename or "audio.webm",
                content_type=voice_mime or "audio/webm",
                user_id=resolved_user,
                project_id=project_id,
            )

    # 5. Orquestar inferencia con Google Gemini (con fallback resiliente y reintento en cascada)
    output: DevStoryOutput = gemini_service.generate_devstory(
        prompt_text=prompt_text,
        sketch_bytes=sketch_bytes,
        sketch_mime=sketch_mime,
        voice_bytes=voice_bytes,
        voice_mime=voice_mime,
        model_tier=model_tier,
    )

    model_used = "gemini-3.8-pro" if model_tier.lower() == "pro" else "gemini-3.8-flash"
    response_payload = output.model_dump()
    response_payload["model_used"] = model_used

    # 6. Modo Invitado Efímero: NO guardar en base de datos si no hay usuario autenticado
    if not resolved_user:
        response_payload["id"] = None
        response_payload["project_id"] = None
        response_payload["persisted"] = False
        response_payload["sketch_path"] = None
        response_payload["audio_path"] = None
        return response_payload

    # Guardar en base de datos si está autenticado
    try:
        saved_record = supabase_service.save_generation(
            output=output,
            user_id=resolved_user,
            project_id=project_id,
            input_type=input_type,
            input_text=prompt_text,
            sketch_path=sketch_path,
            audio_path=audio_path,
            model_used=model_used,
            ip_address=client_ip,
        )
    except RateLimitExceeded as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )

    response_payload["id"] = saved_record.get("id")
    response_payload["project_id"] = saved_record.get("project_id")
    response_payload["persisted"] = True
    response_payload["sketch_path"] = sketch_path
    response_payload["audio_path"] = audio_path

    return response_payload


@app.post("/api/projects/save", tags=["projects"])
async def save_project(
    payload: SaveProjectRequest,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Guarda un proyecto efímero creado en memoria una vez que el usuario se registra o inicia sesión."""
    resolved_user = _resolve_user_id(payload.user_id, authorization)
    if not resolved_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere iniciar sesión para guardar el proyecto en tu cuenta.",
        )

    try:
        saved = supabase_service.save_generation(
            output=payload.output,
            user_id=resolved_user,
            input_type="text",
            input_text=payload.output.title,
            model_used="gemini-3.8-flash",
        )
        return {
            "success": True,
            "project_id": saved.get("project_id"),
            "generation_id": saved.get("id"),
            "persisted": True,
        }
    except Exception as e:
        logger.warning("Error guardando proyecto en /api/projects/save: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine", tags=["generation"])
async def refine_project(
    payload: RefineRequest,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Refina iterativamente la especificación y prototipo actual con instrucciones en lenguaje natural."""
    resolved_user = _resolve_user_id(payload.user_id, authorization)

    refined: DevStoryOutput = gemini_service.refine_devstory(
        current_output=payload.current_output,
        instruction=payload.instruction,
        model_tier=payload.model_tier,
    )

    model_used = "gemini-3.8-pro" if payload.model_tier.lower() == "pro" else "gemini-3.8-flash"
    result = refined.model_dump()
    result["model_used"] = model_used

    # Si el usuario está autenticado, registrar la nueva generación afinada
    if resolved_user:
        try:
            saved = supabase_service.save_generation(
                output=refined,
                user_id=resolved_user,
                project_id=payload.project_id,
                input_type="text",
                input_text=f"Refinamiento: {payload.instruction}",
                model_used=model_used,
            )
            result["id"] = saved.get("id")
            result["project_id"] = saved.get("project_id")
            result["persisted"] = True
        except Exception as e:
            logger.warning("Error guardando refinamiento en base de datos: %s", e)
            result["persisted"] = False
    else:
        result["id"] = None
        result["project_id"] = None
        result["persisted"] = False

    return result


@app.get("/api/projects", tags=["projects"])
async def list_projects(
    user_id: str | None = None,
    authorization: str | None = Header(None),
) -> list[dict[str, Any]]:
    """Lista los proyectos existentes en Supabase para el usuario especificado o autenticado."""
    resolved_user = _resolve_user_id(user_id, authorization)
    if not resolved_user:
        return []
    return supabase_service.get_projects(user_id=resolved_user)


@app.delete("/api/projects/{project_id}", tags=["projects"])
async def delete_project(
    project_id: str,
    user_id: str | None = None,
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Elimina un proyecto del historial validando que pertenezca al usuario autenticado."""
    resolved_user = _resolve_user_id(user_id, authorization)
    if not resolved_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticación requerida para eliminar un proyecto.",
        )

    success = supabase_service.delete_project(project_id=project_id, user_id=resolved_user)
    return {"success": success, "deleted_id": project_id}


@app.post("/api/upgrade-plan", tags=["billing"])
async def upgrade_plan(
    user_id: str = Form(...),
    plan: str = Form("pro"),
    authorization: str | None = Header(None),
) -> dict[str, Any]:
    """Actualiza el plan del usuario a PRO (ej. para la prueba gratuita de 14 días)."""
    updated = supabase_service.update_user_plan(user_id=user_id, plan=plan)
    return {
        "success": True,
        "user_id": user_id,
        "plan": plan,
        "updated": updated,
    }
