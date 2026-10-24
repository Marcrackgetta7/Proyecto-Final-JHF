"""Gemini orchestration (google-genai SDK) with structured output and resilient dynamic fallback."""

import json
import logging
import os
import threading
import time
from typing import Any

from app.env_loader import load_backend_env

try:
    from google import genai
    from google.genai import types
    from google.genai.errors import APIError
    GENAI_AVAILABLE = True
except (ImportError, Exception):
    genai = None  # type: ignore[assignment]
    types = None  # type: ignore[assignment]
    class APIError(Exception):  # type: ignore[no-redef]
        code: int = 0
    GENAI_AVAILABLE = False

from app.schemas import DevStoryOutput, JiraIssueType, JiraPriority, JiraStory

load_backend_env()
logger = logging.getLogger(__name__)

DEFAULT_FLASH_MODEL = "gemini-3.8-flash"
DEFAULT_PRO_MODEL = "gemini-3.8-pro"

GEMINI_MODEL_FLASH = os.getenv("GEMINI_MODEL_FLASH", DEFAULT_FLASH_MODEL)
GEMINI_MODEL_PRO = os.getenv("GEMINI_MODEL_PRO", DEFAULT_PRO_MODEL)

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


DYNAMIC_REACT_TEMPLATE = """const { useState, useEffect, useMemo } = React;

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState([
    { id: 1, name: 'Requerimiento Principal', category: 'Core', status: 'Activo', priority: 'Alta' },
    { id: 2, name: 'Configuración de Parámetros', category: 'Ajustes', status: 'En Proceso', priority: 'Media' },
    { id: 3, name: 'Validación de Rendimiento', category: 'QA', status: 'Completado', priority: 'Baja' },
    { id: 4, name: 'Integración de Notificaciones', category: 'Servicios', status: 'Activo', priority: 'Alta' }
  ]);
  const [newItemName, setNewItemName] = useState('');
  const [showModal, setShowModal] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [items, search]);

  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    setItems([
      ...items,
      {
        id: Date.now(),
        name: newItemName.trim(),
        category: 'Operaciones',
        status: 'Activo',
        priority: 'Media'
      }
    ]);
    setNewItemName('');
    setShowModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/30">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">%%TITLE%%</h1>
              <p className="text-xs text-slate-400">Prototipo funcional interactivo generado para tu especificación</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'dashboard'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Panel General
            </button>
            <button
              onClick={() => setActiveTab('records')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'records'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              Registros ({items.length})
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1 shadow-md shadow-emerald-600/20"
            >
              <span>+ Nuevo</span>
            </button>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Elementos Activos</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-white">{items.filter(i => i.status === 'Activo').length}</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/60">En línea</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 font-medium">En Proceso</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-amber-400">{items.filter(i => i.status === 'En Proceso').length}</span>
              <span className="text-xs font-semibold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-800/60">Pendiente</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg">
            <span className="text-xs text-slate-400 font-medium">Tasa de Efectividad</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-extrabold text-indigo-400">98.4%</span>
              <span className="text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-800/60">+4.2%</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        {activeTab === 'dashboard' ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white">Actividad Reciente y Métricas Operativas</h2>
              <span className="text-xs text-slate-400">Sincronizado hace un momento</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              💡 <strong>Contexto del Proyecto:</strong> %%TOPIC%%
              <p className="mt-2 text-slate-400">
                Este prototipo valida el flujo de navegación, la persistencia en estado local y la distribución ergonómica de elementos solicitados.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Flujo Primario</span>
                <p className="text-xs text-slate-300">Captura de requerimientos multimodales con orquestación continua hacia el backlog de desarrollo.</p>
              </div>
              <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Compatibilidad de Sandbox</span>
                <p className="text-xs text-slate-300">Totalmente desacoplado de dependencias externas. Ejecutable en navegador mediante Babel Standalone.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <input
                type="text"
                placeholder="Buscar por nombre o categoría..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-72 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400">{filteredItems.length} resultados</span>
            </div>

            <div className="divide-y divide-slate-800/80 overflow-hidden rounded-xl border border-slate-800">
              {filteredItems.map(item => (
                <div key={item.id} className="p-3.5 bg-slate-950/50 hover:bg-slate-900 transition flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Categoría: {item.category} • Prioridad: {item.priority}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    item.status === 'Activo'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : item.status === 'En Proceso'
                      ? 'bg-amber-950 text-amber-300 border-amber-800'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Crear */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-white">Nuevo Registro</h3>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
              </div>
              <form onSubmit={handleAddItem} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Nombre o Título</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Notificaciones en tiempo real..."
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:bg-slate-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"""


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


def build_dynamic_fallback(prompt_text: str | None) -> DevStoryOutput:
    """Genera un DevStoryOutput dinámico, adaptado al requerimiento del usuario, en menos de 100ms."""
    topic = (prompt_text or "").strip()
    if not topic:
        topic = "Dashboard y Gestión de Operaciones"

    first_line = topic.split("\n")[0][:50].strip()
    clean_title = first_line.capitalize() if first_line else "Sistema Inteligente DevStory"

    prd = f"""# Product Requirements Document (PRD) — {clean_title}

## 1. Objetivo y Alcance del Producto
Desarrollar una solución moderna, intuitiva y escalable para **{topic}**, optimizando los flujos de trabajo de los usuarios y reduciendo los tiempos de gestión operativa en más de un 40%.

## 2. Historias de Usuario Clave
- **HU-01 (Módulo Principal)**: Como usuario del sistema, quiero acceder al panel interactivo de {clean_title} para visualizar métricas clave y gestionar registros en tiempo real.
- **HU-02 (Filtros y Búsqueda)**: Como operador, quiero filtrar y buscar información relevante de manera instantánea para tomar decisiones basadas en datos.
- **HU-03 (Acciones Rápidas)**: Como administrador, quiero crear, actualizar o exportar reportes directamente desde la interfaz.

## 3. Criterios de Aceptación Detallados (Formato Gherkin)
- **Escenario 1 (Acceso y Carga de Datos)**:
  - *Dado que* el usuario ingresa a la aplicación {clean_title},
  - *Cuando* se completa la carga inicial,
  - *Entonces* se deben presentar los indicadores KPI actualizados y la lista de operaciones disponibles.
- **Escenario 2 (Interacción y Feedback Reactivo)**:
  - *Dado que* el usuario realiza un cambio o aplica un filtro,
  - *Cuando* confirma la acción,
  - *Entonces* la vista debe responder de forma asíncrona sin parpadeos y confirmar el estado de la operación.

## 4. Flujos de Pantalla, Estados y Navegación
- **Vista Resumen / KPIs**: Panel superior con tarjetas de rendimiento y estadísticas rápidas.
- **Vista de Registros / Tareas**: Tabla interactiva con estados dinámicos (Activo, En Proceso, Completado).
- **Modal de Creación**: Ventana modal para incorporar nuevos registros al flujo de trabajo.
"""

    jira = [
        JiraStory(
            summary=f"Implementar interfaz principal y navegación para {clean_title}",
            description=f"Diseñar y maquetar la estructura responsiva de {clean_title} con Tailwind CSS y React 18.",
            acceptance_criteria=[
                "Navegación por pestañas fluida sin recargas completas de página.",
                "Diseño adaptativo para pantallas de escritorio, tablet y móvil."
            ],
            story_points=5,
            priority=JiraPriority.highest,
            issue_type=JiraIssueType.story,
        ),
        JiraStory(
            summary=f"Configurar gestión de estado y filtros para {clean_title}",
            description="Integrar estado local con hooks de React (useState, useMemo) para búsqueda reactiva.",
            acceptance_criteria=[
                "Filtro en tiempo real con respuesta menor a 50ms.",
                "Capacidad de alternar entre diferentes vistas y métricas."
            ],
            story_points=3,
            priority=JiraPriority.high,
            issue_type=JiraIssueType.story,
        ),
        JiraStory(
            summary=f"Integrar endpoints de backend y persistencia para {clean_title}",
            description="Conectar las acciones del usuario con los servicios de datos y validaciones de seguridad.",
            acceptance_criteria=[
                "Manejo de estados de carga (loading) y errores con feedback amigable.",
                "Cumplimiento de estándares de autenticación y autorización."
            ],
            story_points=8,
            priority=JiraPriority.medium,
            issue_type=JiraIssueType.task,
        ),
    ]

    mermaid = f"""graph TD
    A[Usuario: {clean_title}] --> B[Interfaz Web React 18 + Tailwind]
    B --> C[Gestión de Estado React Hooks]
    C --> D[Módulo de Métricas y KPIs]
    C --> E[Listado y Filtros Reactivos]
    B --> F[API Gateway Backend FastAPI]
    F --> G[Base de Datos PostgreSQL]"""

    react = DYNAMIC_REACT_TEMPLATE.replace("%%TITLE%%", clean_title).replace("%%TOPIC%%", topic)

    return DevStoryOutput(
        title=clean_title,
        prd_markdown=prd,
        jira_json=jira,
        mermaid_diagram=mermaid,
        react_code=react,
    )


def _call_with_timeout(func: Any, timeout_sec: float, *args: Any, **kwargs: Any) -> Any:
    """Ejecuta una función en un hilo daemon desacoplado con timeout estricto sin bloquear la salida del proceso."""
    result: list[Any] = [None]
    exception: list[Exception | None] = [None]
    event = threading.Event()

    def worker() -> None:
        try:
            result[0] = func(*args, **kwargs)
        except Exception as e:
            exception[0] = e
        finally:
            event.set()

    thread = threading.Thread(target=worker, daemon=True)
    thread.start()

    finished = event.wait(timeout=timeout_sec)
    if not finished:
        raise TimeoutError(f"Operación excedió el timeout de {timeout_sec}s")

    if exception[0] is not None:
        raise exception[0]

    return result[0]


class GeminiService:
    def __init__(self, api_key: str | None = None) -> None:
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._client: Any = None
        if GENAI_AVAILABLE and self.api_key and genai is not None:
            try:
                http_options = types.HttpOptions(timeout=40.0)
                self._client = genai.Client(api_key=self.api_key, http_options=http_options)
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
        """Call Gemini multimodal inference or return resilient dynamic fallback output on failure."""
        if not GENAI_AVAILABLE or not self._client or not self.api_key:
            logger.warning(
                "Gemini API key is not configured or client failed to initialize. Returning resilient dynamic fallback."
            )
            return build_dynamic_fallback(prompt_text)

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

        if model_tier.lower() == "pro":
            candidate_models = ["gemini-3.8-pro", "gemini-3.8-flash"]
        else:
            candidate_models = ["gemini-3.8-flash"]

        call_timeout = 40.0

        for current_model in candidate_models:
            try:
                response = _call_with_timeout(
                    self._client.models.generate_content,
                    call_timeout,
                    model=current_model,
                    contents=contents,
                    config=config,
                )

                output: DevStoryOutput | None = None
                if hasattr(response, "parsed") and isinstance(response.parsed, DevStoryOutput):
                    output = response.parsed
                elif getattr(response, "text", None):
                    raw_text = response.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text.split("```json", 1)[1]
                    elif raw_text.startswith("```"):
                        raw_text = raw_text.split("```", 1)[1]
                    if raw_text.endswith("```"):
                        raw_text = raw_text.rsplit("```", 1)[0]
                    raw_text = raw_text.strip()
                    output = DevStoryOutput.model_validate_json(raw_text)

                if not output:
                    logger.warning("Gemini (%s) no devolvió datos estructurados legibles.", current_model)
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
                logger.warning(
                    "Fallo llamando a Gemini con modelo %s (%s). Continuando con siguiente modelo...",
                    current_model,
                    exc,
                )
                continue

        logger.warning(
            "Todos los modelos de la cascada fallaron o no respondieron a tiempo. Activando Fallback Dinámico Resiliente."
        )
        return build_dynamic_fallback(prompt_text)

    def refine_devstory(
        self,
        current_output: DevStoryOutput,
        instruction: str,
        model_tier: str = "flash",
    ) -> DevStoryOutput:
        """Aplica refinamiento iterativo mediante IA al DevStoryOutput existente con timeout y fallback."""
        if not GENAI_AVAILABLE or not self._client or not self.api_key:
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

        if model_tier.lower() == "pro":
            candidate_models = ["gemini-3.8-pro", "gemini-3.8-flash"]
        else:
            candidate_models = ["gemini-3.8-flash"]

        call_timeout = 40.0

        for current_model in candidate_models:
            try:
                response = _call_with_timeout(
                    self._client.models.generate_content,
                    call_timeout,
                    model=current_model,
                    contents=[user_prompt],
                    config=config,
                )

                output: DevStoryOutput | None = None
                if hasattr(response, "parsed") and isinstance(response.parsed, DevStoryOutput):
                    output = response.parsed
                elif getattr(response, "text", None):
                    raw_text = response.text.strip()
                    if raw_text.startswith("```json"):
                        raw_text = raw_text.split("```json", 1)[1]
                    elif raw_text.startswith("```"):
                        raw_text = raw_text.split("```", 1)[1]
                    if raw_text.endswith("```"):
                        raw_text = raw_text.rsplit("```", 1)[0]
                    raw_text = raw_text.strip()
                    output = DevStoryOutput.model_validate_json(raw_text)

                if not output:
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
                logger.warning("Fallo durante refinamiento con %s: %s. Continuando...", current_model, exc)
                continue

        logger.warning("Refinamiento falló en todos los modelos. Retornando estado actual.")
        return current_output
