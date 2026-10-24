"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Code,
  Eye,
  Laptop,
  Loader2,
  Maximize2,
  Minimize2,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Tablet,
} from "lucide-react";

interface CanvasPreviewProps {
  reactCode: string;
  onCodeChange?: (newCode: string) => void;
  onRefine?: (instruction: string) => Promise<void>;
  isRefining?: boolean;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

type ViewMode = "desktop" | "tablet" | "mobile";

export function sanitizeReactCode(code: string): string {
  if (!code) return "";
  let cleaned = code.trim();

  // Eliminar bloques markdown fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, "");
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.replace(/\n?```$/, "");
  }

  // Filtrar declaraciones import y export
  const lines = cleaned.split("\n");
  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("import ")) return false;
    if (trimmed.startsWith("export default ")) return false;
    if (trimmed.startsWith("export ")) return false;
    return true;
  });

  let body = filteredLines.join("\n").trim();

  // Asegurar inyección de Hooks de React si no están desestructurados
  const hooksPrefix = "const { useState, useEffect, useMemo, useRef } = React;";
  if (!body.includes("const { useState") && !body.includes("const {useState")) {
    body = `${hooksPrefix}\n\n${body}`;
  }

  return body;
}

export function buildSandboxHtml(code: string): string {
  const sanitized = sanitizeReactCode(code);

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevStory Sandbox</title>
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#6366f1', 600: '#4f46e5' }
          }
        }
      }
    }
  </script>
  <!-- React 18 UMD -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Babel Standalone -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #0b0f19;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      overflow-x: hidden;
    }
    #root {
      min-height: 100vh;
    }
    #error-container {
      display: none;
      padding: 24px;
      margin: 20px;
      background-color: #450a0a;
      border: 1px solid #dc2626;
      border-radius: 12px;
      color: #fca5a5;
      font-family: monospace;
      white-space: pre-wrap;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-container"></div>

  <script type="text/babel">
    window.onerror = function(message, source, lineno, colno, error) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerText = '⚠️ Error en tiempo de ejecución:\\n' + (error ? error.stack : message);
      }
      return false;
    };

    try {
      ${sanitized}

      if (typeof App === 'undefined') {
        throw new Error("No se encontró el componente principal 'App'. Asegúrate de definir 'function App() { ... }'.");
      }

      const rootElement = document.getElementById('root');
      const root = ReactDOM.createRoot(rootElement);
      root.render(<App />);
    } catch (err) {
      const errBox = document.getElementById('error-container');
      if (errBox) {
        errBox.style.display = 'block';
        errBox.innerText = '⚠️ Error de compilación o montaje:\\n' + (err && err.message ? err.message : err);
      }
    }
  </script>
</body>
</html>`;
}

export default function CanvasPreview({
  reactCode,
  onCodeChange,
  onRefine,
  isRefining = false,
  isGuest = false,
  onRequireAuth,
}: CanvasPreviewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [tabMode, setTabMode] = useState<"preview" | "code">("preview");
  const [reloadKey, setReloadKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refineText, setRefineText] = useState("");

  const [localCode, setLocalCode] = useState(reactCode);
  const [debouncedCode, setDebouncedCode] = useState(reactCode);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sincronizar reactCode entrante
  useEffect(() => {
    setLocalCode(reactCode);
    setDebouncedCode(reactCode);
  }, [reactCode]);

  // Debounce de 400ms para no saturar Babel en edición en vivo
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedCode(localCode);
      if (onCodeChange && localCode !== reactCode) {
        onCodeChange(localCode);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [localCode, onCodeChange, reactCode]);

  // Escuchar cambios de fullscreen nativos
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen toggle error:", err);
    }
  };

  const handleRefineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refineText.trim() || isRefining) return;
    if (isGuest && onRequireAuth) {
      onRequireAuth();
      return;
    }
    if (onRefine) {
      await onRefine(refineText.trim());
      setRefineText("");
    }
  };

  const srcDoc = useMemo(() => {
    if (!debouncedCode) return "";
    return buildSandboxHtml(debouncedCode);
  }, [debouncedCode, reloadKey]);

  const viewWidthClass = {
    desktop: "w-full",
    tablet: "w-[768px]",
    mobile: "w-[375px]",
  }[viewMode];

  return (
    <div
      ref={containerRef}
      className={`flex flex-col h-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden ${
        isFullscreen ? "p-4 bg-slate-950" : ""
      }`}
    >
      {/* Barra superior estilo navegador */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          {/* Toggle Vista Previa vs Editor en Vivo */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setTabMode("preview")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                tabMode === "preview"
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Vista Previa</span>
            </button>
            <button
              type="button"
              onClick={() => setTabMode("code")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                tabMode === "code"
                  ? "bg-indigo-600 text-white font-medium"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Editor en Vivo</span>
            </button>
          </div>
        </div>

        {/* Acciones centro / derecha */}
        <div className="flex items-center gap-2">
          {tabMode === "preview" && (
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewMode("desktop")}
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === "desktop"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Desktop 100%"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("tablet")}
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === "tablet"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Tablet 768px"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("mobile")}
                className={`p-1.5 rounded-lg text-xs transition ${
                  viewMode === "mobile"
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Mobile 375px"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Recargar */}
          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title="Recargar Sandbox"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Pantalla Completa */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
            title={isFullscreen ? "Salir de Pantalla Completa" : "Pantalla Completa"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Contenedor Principal (Preview o Split Editor) */}
      <div className="flex-1 bg-slate-950 p-3 sm:p-4 flex flex-col justify-start overflow-hidden min-h-[460px]">
        {tabMode === "code" ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full min-h-[460px]">
            {/* Editor de Código en Vivo */}
            <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-xs font-mono text-indigo-400 flex items-center justify-between">
                <span>App.tsx (Edición React 18 con auto-recarga debounced 400ms)</span>
                <span className="text-[10px] text-slate-500">Live Hot Reload</span>
              </div>
              <textarea
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value)}
                placeholder="// Escribe o modifica tu código React aquí..."
                spellCheck={false}
                className="w-full flex-1 p-3 bg-slate-900 text-slate-200 font-mono text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              />
            </div>

            {/* Vista Previa reactiva simultánea */}
            <div className="flex flex-col h-full bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-xs font-mono text-slate-400">
                <span>Vista en Vivo Compilada</span>
              </div>
              <div className="flex-1 bg-slate-950 p-2 overflow-auto">
                <iframe
                  key={reloadKey}
                  sandbox="allow-scripts"
                  srcDoc={srcDoc}
                  title="Canvas Sandbox Live"
                  className="w-full h-full min-h-[400px] border-none rounded-lg bg-slate-900"
                />
              </div>
            </div>
          </div>
        ) : debouncedCode ? (
          <div className="flex-1 flex justify-center items-start overflow-auto">
            <div
              className={`h-full min-h-[480px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-800 transition-all duration-300 ${viewWidthClass}`}
            >
              <iframe
                key={reloadKey}
                sandbox="allow-scripts"
                srcDoc={srcDoc}
                title="Canvas Sandbox"
                className="w-full h-full min-h-[480px] border-none"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 my-auto">
            <Laptop className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
            <p className="text-sm font-medium text-slate-300">Canvas UI en Espera</p>
            <p className="text-xs text-slate-500 max-w-sm mt-1">
              Ingresa un boceto o requerimientos y presiona Generar para compilar el componente React en vivo.
            </p>
          </div>
        )}
      </div>

      {/* Barra de Refinamiento Iterativo con IA */}
      <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-800">
        <form onSubmit={handleRefineSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
            <input
              type="text"
              value={refineText}
              onChange={(e) => setRefineText(e.target.value)}
              disabled={isRefining || !reactCode}
              placeholder={
                reactCode
                  ? isGuest
                    ? "Crea una cuenta para refinar el prototipo con IA..."
                    : "✨ Refinar con IA: Ej. 'Cambia el botón a verde esmeralda y agrega una tabla con paginación'..."
                  : "Genera primero un prototipo para refinarlo..."
              }
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isRefining || !refineText.trim() || !reactCode}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-medium shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            {isRefining ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Refinando...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>{isGuest ? "Desbloquear Refinamiento" : "Refinar"}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
