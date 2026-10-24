"""Supabase service for project and generation persistence, storage and quota checks."""

from datetime import datetime, timezone
import logging
import os
import time
from typing import Any
import uuid

from app.env_loader import load_backend_env
from supabase import Client, create_client

from app.schemas import DevStoryOutput

load_backend_env()
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_STORAGE_BUCKET = os.getenv("SUPABASE_STORAGE_BUCKET", "sketches_audio")


class RateLimitExceeded(Exception):
    """Excepción lanzada cuando el usuario supera la cuota mensual del plan Free."""


class SupabaseService:
    def __init__(self, url: str | None = None, service_key: str | None = None) -> None:
        self.url = url or SUPABASE_URL
        self.service_key = service_key or SUPABASE_SERVICE_ROLE_KEY
        self.bucket = SUPABASE_STORAGE_BUCKET
        self._client: Client | None = None

        if self.url and self.service_key:
            try:
                self._client = create_client(self.url, self.service_key)
            except Exception as e:
                logger.warning("No se pudo inicializar el cliente de Supabase: %s", e)
        else:
            logger.warning(
                "SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados. SupabaseService operará en modo memoria/test."
            )

    @property
    def is_configured(self) -> bool:
        return self._client is not None

    def check_rate_limit(self, user_id: str | None, ip_address: str | None = None) -> None:
        """Verifica si el usuario del plan Free ha superado el límite mensual (máx 5 generaciones)."""
        if not user_id or not self._client:
            return

        try:
            # Obtener plan del usuario
            user_res = (
                self._client.table("users")
                .select("plan")
                .eq("id", user_id)
                .limit(1)
                .execute()
            )
            user_data = user_res.data
            if not user_data:
                # Si el perfil aún no existe, por defecto asume free
                plan = "free"
            else:
                plan = user_data[0].get("plan", "free")

            if plan == "pro":
                return

            # Contar generaciones activas en el mes actual (UTC)
            start_of_month = (
                datetime.now(timezone.utc)
                .replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                .isoformat()
            )

            gen_res = (
                self._client.table("generations")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .neq("status", "failed")
                .gte("created_at", start_of_month)
                .execute()
            )

            count = gen_res.count if gen_res.count is not None else len(gen_res.data or [])
            if count >= 5:
                raise RateLimitExceeded(
                    "Límite de cuota alcanzado: El plan Free permite un máximo de 5 generaciones al mes."
                )

        except RateLimitExceeded:
            raise
        except Exception as e:
            logger.warning("Error durante verificación de rate limit: %s", e)

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        user_id: str | None = None,
        project_id: str | None = None,
    ) -> str | None:
        """Sube un archivo multimedia al bucket de Supabase Storage y retorna su ruta relativa."""
        if not self._client or not file_bytes:
            return None

        target_user = user_id or "anonymous"
        target_project = project_id or "general"
        clean_filename = filename.replace(" ", "_")
        storage_path = f"{target_user}/{target_project}/{int(time.time())}_{clean_filename}"

        try:
            self._client.storage.from_(self.bucket).upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            return storage_path
        except Exception as e:
            logger.warning("Error al subir archivo a Supabase Storage (%s): %s", storage_path, e)
            return None

    def get_or_create_project(self, user_id: str, project_name: str) -> str:
        """Obtiene un proyecto existente del usuario o crea uno nuevo."""
        if not self._client:
            return str(uuid.uuid4())

        try:
            # Buscar proyecto con el mismo nombre para este usuario
            res = (
                self._client.table("projects")
                .select("id")
                .eq("user_id", user_id)
                .eq("name", project_name[:120])
                .limit(1)
                .execute()
            )
            if res.data and len(res.data) > 0:
                return res.data[0]["id"]

            # Si no existe, crear nuevo proyecto
            new_proj = (
                self._client.table("projects")
                .insert({"user_id": user_id, "name": project_name[:120]})
                .execute()
            )
            if new_proj.data:
                return new_proj.data[0]["id"]
        except Exception as e:
            logger.warning("Error obteniendo o creando proyecto: %s", e)

        return str(uuid.uuid4())

    def save_generation(
        self,
        output: DevStoryOutput,
        user_id: str | None = None,
        project_id: str | None = None,
        input_type: str = "text",
        input_text: str | None = None,
        sketch_path: str | None = None,
        audio_path: str | None = None,
        model_used: str = "gemini-2.5-flash",
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Guarda la generación en la base de datos de Supabase.

        Soporta tanto un user_id registrado como ejecuciones de prueba/anónimas.
        """
        generation_id = str(uuid.uuid4())

        # Si no hay cliente o no se proporciona user_id, retorna estructura local
        if not self._client or not user_id:
            logger.info("Generación completada en modo anónimo o sin conexión activa a Supabase.")
            return {
                "id": generation_id,
                "project_id": project_id or "demo-project",
                "user_id": user_id,
                "title": output.title,
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        # Asegurar un proyecto para el usuario
        resolved_project_id = project_id or self.get_or_create_project(
            user_id=user_id, project_name=output.title or "Proyecto DevStory"
        )

        jira_data = [story.model_dump() for story in output.jira_json]

        record = {
            "id": generation_id,
            "project_id": resolved_project_id,
            "user_id": user_id,
            "input_type": input_type,
            "input_text": input_text,
            "sketch_path": sketch_path,
            "audio_path": audio_path,
            "model_used": model_used,
            "status": "completed",
            "title": output.title,
            "prd_markdown": output.prd_markdown,
            "jira_json": jira_data,
            "mermaid_diagram": output.mermaid_diagram,
            "react_code": output.react_code,
            "tokens_used": 0,
        }

        if ip_address:
            record["ip_address"] = ip_address

        try:
            insert_res = self._client.table("generations").insert(record).execute()
            if insert_res.data:
                return insert_res.data[0]
            return record
        except Exception as e:
            err_msg = str(e)
            if "RATE_LIMIT_EXCEEDED" in err_msg or "P0429" in err_msg:
                raise RateLimitExceeded(
                    "El trigger de Supabase rechazó la inserción: cuota mensual de 5 generaciones superada."
                )
            logger.warning("Error al guardar generación en Supabase: %s", e)
            return record

    def delete_project(self, project_id: str, user_id: str) -> bool:
        """Elimina un proyecto y sus generaciones en cascada validando la propiedad del usuario."""
        if not self._client or not user_id or not project_id:
            return False
        try:
            res = (
                self._client.table("projects")
                .delete()
                .eq("id", project_id)
                .eq("user_id", user_id)
                .execute()
            )
            return True
        except Exception as e:
            logger.warning("Error al eliminar proyecto %s del usuario %s: %s", project_id, user_id, e)
            return False

    def update_user_plan(self, user_id: str, plan: str = "pro") -> dict[str, Any] | None:
        """Actualiza el plan del usuario (ejecutado con service_role)."""
        if not self._client or not user_id:
            return None
        try:
            res = (
                self._client.table("users")
                .update({"plan": plan})
                .eq("id", user_id)
                .execute()
            )
            return res.data[0] if res.data else None
        except Exception as e:
            logger.warning("Error al actualizar plan del usuario %s: %s", user_id, e)
            return None

    def get_projects(self, user_id: str | None = None) -> list[dict[str, Any]]:
        """Consulta y lista los proyectos guardados en Supabase, incluyendo sus generaciones."""
        if not self._client:
            return [
                {
                    "id": "demo-project",
                    "name": "DevStory AI Demo Project",
                    "description": "Proyecto en memoria para demostración.",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "generations": [],
                }
            ]

        try:
            # Consulta con relación embebida de generaciones
            query = (
                self._client.table("projects")
                .select("*, generations(*)")
                .order("created_at", desc=True)
            )
            if user_id:
                query = query.eq("user_id", user_id)
            else:
                query = query.limit(20)

            res = query.execute()
            return res.data or []
        except Exception as e:
            logger.warning("Error consultando proyectos con generaciones en Supabase: %s", e)
            # Fallback simple sin relación
            try:
                fallback_query = self._client.table("projects").select("*").order("created_at", desc=True)
                if user_id:
                    fallback_query = fallback_query.eq("user_id", user_id)
                else:
                    fallback_query = fallback_query.limit(20)
                res = fallback_query.execute()
                return res.data or []
            except Exception as inner_e:
                logger.warning("Error en fallback de proyectos: %s", inner_e)
                return []
