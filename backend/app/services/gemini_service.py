"""Gemini orchestration (google-genai SDK) with structured output."""

import json
import logging
import os
from typing import Any

from app.env_loader import load_backend_env
from google import genai
from google.genai import types
try:
    from google.genai.errors import APIError
except ImportError:
    class APIError(Exception):  # type: ignore[no-redef]
        code: int = 0

from app.schemas import DevStoryOutput, JiraIssueType, JiraPriority, JiraStory

load_backend_env()
logger = logging.getLogger(__name__)

GEMINI_MODEL_FLASH = os.getenv("GEMINI_MODEL_FLASH", "gemini-3.8-flash")
GEMINI_MODEL_PRO = os.getenv("GEMINI_MODEL_PRO", "gemini-3.8-pro")

SYSTEM_INSTRUCTION = """Actúa como un Arquitecto de Software y Diseñador UI/UX Senior de clase mundial.
Tu objetivo es analizar los requerimientos del usuario (los cuales pueden incluir notas de texto, bocetos a mano en imágenes o notas de voz transcritas/audio) y generar una especificación técnica de producto integral y un prototipo frontend interactivo.

Debes responder estrictamente en formato JSON conforme al esquema DevStoryOutput solicitado, con los siguientes campos en español:

1. `title`: Nombre conciso, profesional y representativo de la aplicación o funcionalidad.
2. `prd_markdown`: Documento de Requerimientos de Producto (PRD) completo y formal en formato Markdown con las siguientes secciones obligatorias:
   - ## 1. Objetivo y Alcance del Producto
   - ## 2. Historias de Usuario Clave
   - ## 3. Criterios de Aceptación Detallados (formato Gherkin: Dado que, Cuando, Entonces)
   - ## 4. Flujos de Pantalla, Estados y Navegación
3. `jira_json`: Lista de historias estructuradas para Jira/Trello (objetos JiraStory con summary, description, acceptance_criteria, story_points en escala Fibonacci 1,2,3,5,8,13, priority 'Highest'|'High'|'Medium'|'Low'|'Lowest' e issue_type 'Story'|'Task'|'Bug'|'Epic').
4. `mermaid_diagram`: Diagrama de arquitectura o flujo en sintaxis Mermaid (`graph TD`) PURO, SIN bloques ```mermaid ni delimitadores adicionales de código.
5. `react_code`: Prototipo web interactivo en UN SOLO componente funcional llamado `App` con Tailwind CSS.
   REGLAS ESTRICTAS PARA EL SANDBOX (Babel Standalone dentro de un iframe):
   - PROHIBIDO usar declaraciones 'import' o 'export default App'.
   - Debe iniciar obligatoriamente con: `const { useState, useEffect, useMemo } = React;`
   - Para iconos, utiliza ÚNICAMENTE SVGs inline con clases de Tailwind CSS (no utilices paquetes externos como lucide-react ni react-icons).
   - El componente DEBE ser altamente interactivo (pestañas activas, modales, formularios reactivos, estados visuales y diseño responsivo elegante).
"""

DEMO_FALLBACK_OUTPUT = DevStoryOutput(
    title="DevStory MVP - Prototipo Generado",
    prd_markdown="""# Product Requirements Document (PRD) — DevStory MVP

## 1. Objetivo y Alcance del Producto
Crear un entorno unificado donde ingenieros de producto y diseñadores puedan convertir bocetos rápidos y notas de voz en especificaciones funcionales listas para desarrollo en menos de 30 segundos.

## 2. Historias de Usuario Clave
- **HU-01**: Como Tech Lead, quiero ingresar notas y diagramas en un solo flujo para obtener la descomposición de tareas en Jira.
- **HU-02**: Como Desarrollador Frontend, quiero previsualizar un componente funcional en React con Tailwind para validar la experiencia de usuario de inmediato.

## 3. Criterios de Aceptación Detallados
- **Escenario 1 (Conversión de Boceto)**:
  - *Dado que* el usuario adjunta una imagen o boceto a mano,
  - *Cuando* solicita la generación de la historia,
  - *Entonces* el sistema genera el PRD, diagrama Mermaid y componente interactivo correspondiente.

## 4. Flujos de Pantalla, Estados y Navegación
- **Dashboard Principal**: Entrada multimodal (texto/boceto/voz).
- **Workspace**: División de pantalla entre Documentador PRD y Canvas UI interactivo.
""",
    jira_json=[
        JiraStory(
            summary="Como usuario, quiero ingresar requerimientos multimodales para generar un PRD",
            description="Permitir la ingesta de notas de voz, texto y capturas de bocetos en la vista principal.",
            acceptance_criteria=[
                "Dado que el usuario carga un boceto en formato PNG/JPG, el sistema debe aceptarlo hasta 10MB.",
                "Dado que el usuario envía requerimientos, el tiempo de respuesta debe ser menor a 15 segundos."
            ],
            story_points=5,
            priority=JiraPriority.high,
            issue_type=JiraIssueType.story,
        ),
        JiraStory(
            summary="Como desarrollador, quiero previsualizar el prototipo en un sandbox aislado",
            description="Renderizar el código React en un iframe seguro con Babel Standalone y Tailwind CSS.",
            acceptance_criteria=[
                "Dado que se genera código React, se valida sintácticamente antes de inyectarlo.",
                "El iframe debe bloquear accesos al DOM principal mediante sandbox allow-scripts."
            ],
            story_points=3,
            priority=JiraPriority.medium,
            issue_type=JiraIssueType.task,
        ),
    ],
    mermaid_diagram="""graph TD
    A[Usuario: Voz / Boceto / Texto] --> B[DevStory Backend FastAPI]
    B --> C[Google Gemini 2.5 Multimodal]
    C --> D[DevStoryOutput JSON]
    D --> E[Documentador PRD Markdown]
    D --> F[Jira / Trello JSON Export]
    D --> G[Canvas Sandbox React + Tailwind]""",
    react_code="""const { useState, useEffect, useMemo } = React;

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [items, setItems] = useState([
    { id: 1, title: 'Diseño de Arquitectura', status: 'Completado' },
    { id: 2, title: 'Integración Gemini 2.5', status: 'En Progreso' },
    { id: 3, title: 'Sandbox Babel Iframe', status: 'Pendiente' },
  ]);
  const [newItemTitle, setNewItemTitle] = useState('');

  const addItem = (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;
    setItems([...items, { id: Date.now(), title: newItemTitle.trim(), status: 'Pendiente' }]);
    setNewItemTitle('');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6 flex flex-col items-center">
      <div className="max-w-3xl w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6">
        <header className="flex items-center justify-between border-b border-slate-700 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              DS
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DevStory AI — Workspace</h1>
              <p className="text-xs text-slate-400">Prototipo interactivo en vivo</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Resumen
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'tasks' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Tareas ({items.length})
            </button>
          </div>
        </header>

        {activeTab === 'overview' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-750 p-4 rounded-xl border border-slate-700 bg-slate-900/40">
                <p className="text-xs text-slate-400">Estado del Modelo</p>
                <p className="text-lg font-bold text-emerald-400 mt-1">Activo (2.5)</p>
              </div>
              <div className="bg-slate-750 p-4 rounded-xl border border-slate-700 bg-slate-900/40">
                <p className="text-xs text-slate-400">Tareas Totales</p>
                <p className="text-lg font-bold text-indigo-400 mt-1">{items.length}</p>
              </div>
              <div className="bg-slate-750 p-4 rounded-xl border border-slate-700 bg-slate-900/40">
                <p className="text-xs text-slate-400">Entorno</p>
                <p className="text-lg font-bold text-purple-400 mt-1">Sandbox</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-sm">
              ✨ Prototipo generado automáticamente a partir de los requerimientos y bocetos.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <form onSubmit={addItem} className="flex gap-2">
              <input
                type="text"
                placeholder="Nueva tarea o requerimiento..."
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
              >
                Agregar
              </button>
            </form>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-700 text-sm"
                >
                  <span className="font-medium text-slate-200">{item.title}</span>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                      item.status === 'Completado'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : item.status === 'En Progreso'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
""",
)


def _sanitize_react_code(code: str) -> str:
    """Ensure react_code starts with React hooks and removes import/export statements."""
    cleaned = code.strip()
    if cleaned.startswith("```jsx") or cleaned.startswith("```javascript") or cleaned.startswith("```tsx") or cleaned.startswith("```react"):
        cleaned = cleaned.split("\n", 1)[1]
    elif cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    cleaned = cleaned.strip()

    lines = cleaned.splitlines()
    filtered_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("import ") or stripped.startswith("export default") or stripped.startswith("export "):
            continue
        filtered_lines.append(line)

    body = "\n".join(filtered_lines).strip()
    prefix = "const { useState, useEffect, useMemo } = React;"
    if not body.startswith("const {") and "useState" not in body.splitlines()[0]:
        body = f"{prefix}\n\n{body}"
    return body


def _sanitize_mermaid(diagram: str) -> str:
    """Ensure mermaid_diagram does not contain markdown code fences."""
    cleaned = diagram.strip()
    if cleaned.startswith("```mermaid") or cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1]
    if cleaned.endswith("```"):
        cleaned = cleaned.rsplit("```", 1)[0]
    return cleaned.strip()


class GeminiService:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._client: genai.Client | None = None
        if self.api_key:
            try:
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                logger.warning("Could not initialize Google GenAI Client: %s", e)

    def generate_devstory(
        self,
        prompt_text: str,
        sketch_bytes: bytes | None = None,
        sketch_mime: str | None = None,
        voice_bytes: bytes | None = None,
        voice_mime: str | None = None,
        model_tier: str = "flash",
    ) -> DevStoryOutput:
        """Call Gemini multimodal inference or return resilient fallback output on failure."""
        model_name = GEMINI_MODEL_PRO if model_tier.lower() == "pro" else GEMINI_MODEL_FLASH

        if not self._client or not self.api_key:
            logger.warning(
                "Gemini API key is not configured or client failed to initialize. Returning resilient demo fallback output."
            )
            return DEMO_FALLBACK_OUTPUT

        contents: list[Any] = []

        if sketch_bytes and sketch_mime:
            contents.append(
                types.Part.from_bytes(
                    data=sketch_bytes,
                    mime_type=sketch_mime,
                )
            )

        if voice_bytes and voice_mime:
            contents.append(
                types.Part.from_bytes(
                    data=voice_bytes,
                    mime_type=voice_mime,
                )
            )

        user_prompt = (
            prompt_text.strip()
            if prompt_text and prompt_text.strip()
            else "Analiza el boceto/audio adjunto y genera el PRD, backlog de Jira, diagrama y componente React."
        )
        contents.append(user_prompt)

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=DevStoryOutput,
            temperature=0.3,
        )

        # Cascada de reintento: modelo preferido -> fallback secuencial
        candidate_models = [model_name]
        for fallback_model in ["gemini-3.8-flash", "gemini-2.0-flash"]:
            if fallback_model not in candidate_models:
                candidate_models.append(fallback_model)

        for current_model in candidate_models:
            try:
                response = self._client.models.generate_content(
                    model=current_model,
                    contents=contents,
                    config=config,
                )

                # Extract output
                output: DevStoryOutput
                if hasattr(response, "parsed") and isinstance(response.parsed, DevStoryOutput):
                    output = response.parsed
                elif getattr(response, "text", None):
                    output = DevStoryOutput.model_validate_json(response.text)
                else:
                    logger.warning("Gemini (%s) response did not contain parsed object or text.", current_model)
                    continue

                # Sanitize mermaid and react_code to guarantee strict sandbox compliance
                sanitized_mermaid = _sanitize_mermaid(output.mermaid_diagram)
                sanitized_react = _sanitize_react_code(output.react_code)

                return DevStoryOutput(
                    title=output.title,
                    prd_markdown=output.prd_markdown,
                    jira_json=output.jira_json,
                    mermaid_diagram=sanitized_mermaid,
                    react_code=sanitized_react,
                )

            except Exception as exc:
                is_not_found = False
                if isinstance(exc, APIError):
                    if getattr(exc, "code", None) == 404 or "404" in str(exc) or "NOT_FOUND" in str(exc):
                        is_not_found = True
                elif "404" in str(exc) or "NOT_FOUND" in str(exc):
                    is_not_found = True

                if is_not_found:
                    logger.warning(
                        "Modelo %s no encontrado (404/NOT_FOUND). Ejecutando reintento en cascada...",
                        current_model,
                    )
                    continue
                else:
                    logger.warning(
                        "Exception llamando a Gemini (%s): %s",
                        current_model,
                        exc,
                    )
                    break

        logger.warning(
            "Todos los modelos de la cascada fallaron o no están disponibles. Devolviendo DevStoryOutput de contingencia."
        )
        return DEMO_FALLBACK_OUTPUT

    def refine_devstory(
        self,
        current_output: DevStoryOutput,
        instruction: str,
        model_tier: str = "flash",
    ) -> DevStoryOutput:
        """Aplica refinamiento iterativo mediante IA al DevStoryOutput existente."""
        model_name = GEMINI_MODEL_PRO if model_tier.lower() == "pro" else GEMINI_MODEL_FLASH

        if not self._client or not self.api_key:
            logger.warning("Gemini API key no configurada para refinamiento. Retornando salida actual.")
            return current_output

        user_prompt = f"""El usuario desea refinar la especificación y prototipo existentes con la siguiente instrucción de cambio:
"{instruction.strip()}"

A continuación se encuentra el estado actual del producto:
- Título actual: {current_output.title}
- PRD actual:
{current_output.prd_markdown}

- Historias Jira actuales:
{json.dumps([s.model_dump() for s in current_output.jira_json], ensure_ascii=False)}

- Diagrama Mermaid actual:
{current_output.mermaid_diagram}

- Código React actual:
{current_output.react_code}

INSTRUCCIÓN:
Modifica de forma coherente el componente React (manteniendo las reglas de sandbox: sin imports, const {{ useState, useEffect, useMemo }} = React, SVGs inline, App function), actualiza el PRD Markdown, adapta el diagrama Mermaid y las historias de Jira de acuerdo a la instrucción del usuario. Devuelve el resultado en formato JSON estricto DevStoryOutput."""

        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=DevStoryOutput,
            temperature=0.3,
        )

        candidate_models = [model_name]
        for fallback_model in ["gemini-3.8-flash", "gemini-2.0-flash"]:
            if fallback_model not in candidate_models:
                candidate_models.append(fallback_model)

        for current_model in candidate_models:
            try:
                response = self._client.models.generate_content(
                    model=current_model,
                    contents=[user_prompt],
                    config=config,
                )

                output: DevStoryOutput
                if hasattr(response, "parsed") and isinstance(response.parsed, DevStoryOutput):
                    output = response.parsed
                elif getattr(response, "text", None):
                    output = DevStoryOutput.model_validate_json(response.text)
                else:
                    continue

                sanitized_mermaid = _sanitize_mermaid(output.mermaid_diagram)
                sanitized_react = _sanitize_react_code(output.react_code)

                return DevStoryOutput(
                    title=output.title,
                    prd_markdown=output.prd_markdown,
                    jira_json=output.jira_json,
                    mermaid_diagram=sanitized_mermaid,
                    react_code=sanitized_react,
                )
            except Exception as exc:
                is_not_found = False
                if isinstance(exc, APIError):
                    if getattr(exc, "code", None) == 404 or "404" in str(exc) or "NOT_FOUND" in str(exc):
                        is_not_found = True
                elif "404" in str(exc) or "NOT_FOUND" in str(exc):
                    is_not_found = True

                if is_not_found:
                    logger.warning("Modelo %s no encontrado durante refinamiento. Probando fallback...", current_model)
                    continue
                else:
                    logger.warning("Error durante refinamiento con %s: %s", current_model, exc)
                    break

        logger.warning("Refinamiento falló en todos los modelos. Retornando estado actual.")
        return current_output
