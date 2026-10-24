# DevStory AI — Del Boceto al Código en 30 Segundos 🚀

> **Plataforma SaaS B2B AI-Native:** Convierte notas de voz en español, requerimientos en texto o bocetos a mano (papel/pizarra digital) en **Documentación Técnica de Producto (PRD)**, **Backlog estructurado para Jira/Trello**, **Diagramas de Arquitectura Mermaid** y **Prototipos Interactivos de Código Frontend (React 18 + Tailwind CSS)** en segundos.

Diseñado bajo la arquitectura **"Free-Tier Hack"** para operar con **$0 USD** de costo de infraestructura inicial aprovechando las capas gratuitas de plataformas modernas y garantizando disponibilidad 24/7 sin suspensión de servidor.

---

## 🏛️ Arquitectura del Ecosistema ($0 USD Free-Tier)

```
[ Navegador / Cliente ]
  ├── Next.js 14 App Router (Vercel CDN)
  ├── Pizarra Digital HTML5 Canvas + MediaRecorder API
  └── Sandbox Iframe Aislado (React 18 + Babel Standalone + Tailwind CDN)
            │
            ├── (1) Autenticación OAuth Google/GitHub & Storage ──> [ Supabase ]
            │                                                      ├── Auth & PostgreSQL
            │                                                      ├── Storage Bucket: sketches_audio
            │                                                      └── Trigger RLS Rate Limiting (5/mes)
            │
            └── (2) Peticiones Multipart/Form-Data ───────────────> [ Render Free Tier ]
                                                                   ├── FastAPI / Python 3.11
                                                                   └── Orquestador Google GenAI SDK
                                                                            │
                                                                            └──> [ Google Gemini 2.5 ]
                                                                                 ├── Flash: Visión y Audio
                                                                                 └── Pro: Arquitectura & Código
[ UptimeRobot ]
  └── Monitor Anti-Sleep (Ping GET/HEAD cada 5 min a /health) ───> [ Render FastAPI ]
```

---

## 📦 Estructura del Repositorio

```
Proyecto-Final-JHF/
├── CONTEXT.md                    # Memoria técnica ultra-compacta del proyecto
├── render.yaml                   # Definición de infraestructura como código para Render
├── README.md                     # Documentación oficial y manual de despliegue
├── supabase/
│   └── schema.sql                # Tablas (users, projects, generations), RLS, Storage y Rate Limiting
├── backend/
│   ├── requirements.txt          # Dependencias Python (FastAPI, Google GenAI, Supabase, etc.)
│   ├── .env.example              # Plantilla de variables de entorno del servidor
│   └── app/
│       ├── main.py               # API REST con endpoints /health, /api/generate, /api/projects
│       ├── schemas.py            # Contratos Pydantic de salida estructurada (DevStoryOutput)
│       ├── env_loader.py         # Cargador resiliente de variables de entorno
│       └── services/
│           ├── gemini_service.py # Inferencia multimodal con Gemini 2.5 y fallback resiliente
│           └── supabase_service.py # Almacenamiento, proyectos y control de cuotas
└── frontend/
    ├── package.json              # Dependencias de Next.js, React Markdown, Mermaid, Lucide
    ├── .env.local.example        # Plantilla de variables de entorno del cliente
    ├── public/audio/             # Directorio para alojar la pista musical de Suno AI
    └── src/
        ├── app/                  # Layout y Workspace principal en dos columnas
        ├── components/
        │   ├── audio/            # Reproductor de música ambiente y sintetizador Web Audio
        │   ├── auth/             # Modal de inicio/registro instantáneo en Supabase
        │   ├── input/            # Pizarra Digital Canvas y Grabadora de voz multimodal
        │   ├── modals/           # Modal de conversión AIDA (Upgrade Pro y Referidos +10)
        │   └── modules/          # CanvasPreview (Babel), DocumentadorPRD y Exportador (Jira API)
        └── lib/
            └── supabase.ts       # Cliente Supabase, helpers de API y salud del sistema
```

---

## 🔑 Diccionario de Variables de Entorno

### Backend (`backend/.env`)

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `GEMINI_API_KEY` | Secreto | API Key de Google AI Studio | `AIzaSy...` |
| `GEMINI_MODEL_FLASH` | String | Modelo para procesamiento rápido multimodal | `gemini-2.5-flash` |
| `GEMINI_MODEL_PRO` | String | Modelo para razonamiento profundo y código | `gemini-2.5-pro` |
| `SUPABASE_URL` | URL | URL base del proyecto Supabase | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto | Clave Service Role (solo backend, bypass RLS) | `eyJh...` |
| `SUPABASE_STORAGE_BUCKET` | String | Nombre del bucket para imágenes y audios | `sketches_audio` |
| `ALLOWED_ORIGINS` | Lista | Orígenes permitidos para CORS (separados por coma) | `http://localhost:3000,https://devstory.app` |
| `MAX_UPLOAD_MB` | Número | Límite máximo en MB para archivos adjuntos | `10` |
| `ENVIRONMENT` | String | Entorno de ejecución (`development` / `production`) | `production` |

### Frontend (`frontend/.env.local`)

| Variable | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL | URL pública del proyecto Supabase | `https://xyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Clave pública anónima de Supabase | `eyJh...` |
| `NEXT_PUBLIC_API_URL` | URL | URL del backend FastAPI | `http://localhost:8000` |

---

## 🎵 Música Ambiente Suno AI (Modo Focus)

DevStory AI incluye un reproductor con el **Modo Focus** en el Navbar:
1. Genera una pista instrumental lo-fi / ambient libre de derechos en [Suno AI](https://suno.com).
2. Descarga el archivo de audio MP3 y colócalo en:
   ```
   frontend/public/audio/suno-ambient.mp3
   ```
3. Si el archivo no existe o se produce un error 404, el sistema activará de forma automática y transparente un **sintetizador armónico binaural nativo basado en la Web Audio API**.

---

## 🚀 Guía de Despliegue en Producción ($0 USD)

### Paso 1: Base de Datos y Storage en Supabase
1. Crea un proyecto gratuito en [Supabase](https://supabase.com).
2. Ve al **SQL Editor** y ejecuta íntegramente el script `supabase/schema.sql`.
   - Crea las tablas `users`, `projects` y `generations`.
   - Configura las políticas RLS y el bucket privado `sketches_audio`.
   - Activa el trigger `enforce_generation_quota` (máx. 5 generaciones/mes en plan Free).
3. En **Authentication > Providers**, activa Google y/o GitHub OAuth si deseas inicio de sesión social. Asegúrate de desactivar la confirmación obligatoria por correo para login instantáneo.

### Paso 2: Backend FastAPI en Render Free
1. Crea una cuenta en [Render](https://render.com).
2. Conecta tu repositorio de GitHub y selecciona **New > Blueprint**. Render detectará automáticamente el archivo `render.yaml`.
3. Alternativamente, crea un **Web Service**:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path:** `/health`
4. Agrega las variables de entorno especificadas en la sección del backend. Copia la URL pública generada (ej: `https://devstory-backend.onrender.com`).

### Paso 3: Persistencia Activa 24/7 con UptimeRobot (Anti-Sleep)
Los contenedores gratuitos de Render entran en suspensión tras 15 minutos de inactividad:
1. Crea una cuenta gratuita en [UptimeRobot](https://uptimerobot.com).
2. Crea un **New Monitor**:
   - **Monitor Type:** `HTTP(s)`
   - **Friendly Name:** `DevStory Backend Anti-Sleep`
   - **URL (or IP):** `https://devstory-backend.onrender.com/health`
   - **Monitoring Interval:** `Every 5 minutes`
3. UptimeRobot enviará una petición `HEAD /health` cada 5 minutos, garantizando que el backend permanezca encendido con respuesta inmediata sin costo alguno.

### Paso 4: Frontend en Vercel
1. Ingresa a [Vercel](https://vercel.com) e importa el repositorio de GitHub.
2. Configura:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Next.js`
3. Añade las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL` (URL pública de Render obtenida en el Paso 2).
4. Haz clic en **Deploy**. Tu SaaS estará online en segundos en `https://devstory.vercel.app` o tu dominio personalizado.

---

## 💻 Ejecución en Entorno Local

### 1. Iniciar Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Verifica que responda en: `http://localhost:8000/health` o visita la documentación Swagger en `http://localhost:8000/docs`.

### 2. Iniciar Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```
Abre tu navegador en `http://localhost:3000`.
