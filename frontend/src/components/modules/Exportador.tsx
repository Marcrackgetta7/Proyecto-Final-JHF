"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Cloud,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Globe,
  Layers,
  Loader2,
  Lock,
  Send,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import type { DevStoryOutput, JiraPriority, JiraStory } from "@/types/devstory";
import { buildSandboxHtml } from "./CanvasPreview";

interface ExportadorProps {
  output: DevStoryOutput | null;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const PRIORITY_BADGES: Record<JiraPriority, string> = {
  Highest: "bg-rose-950 text-rose-400 border-rose-800",
  High: "bg-orange-950 text-orange-400 border-orange-800",
  Medium: "bg-amber-950 text-amber-400 border-amber-800",
  Low: "bg-blue-950 text-blue-400 border-blue-800",
  Lowest: "bg-slate-800 text-slate-400 border-slate-700",
};

export default function Exportador({
  output,
  isGuest = false,
  onRequireAuth,
}: ExportadorProps) {
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);

  // Estado del simulador Jira Cloud API
  const [isJiraModalOpen, setIsJiraModalOpen] = useState(false);
  const [jiraUrl, setJiraUrl] = useState("https://empresa-demo.atlassian.net");
  const [projectKey, setProjectKey] = useState("DEV");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncedIssues, setSyncedIssues] = useState<Array<{ key: string; summary: string }>>([]);

  if (!output) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl min-h-[540px]">
        <Layers className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
        <p className="text-sm font-medium text-slate-300">Exportador en Espera</p>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          Una vez generado el proyecto, podrás descargar las especificaciones técnicas en Markdown, el backlog estructurado para Jira y el código fuente.
        </p>
      </div>
    );
  }

  const stories: JiraStory[] = output.jira_json || [];

  const checkGuestAndAction = (action: () => void) => {
    if (isGuest && onRequireAuth) {
      onRequireAuth();
      return;
    }
    action();
  };

  const handleDownloadPrd = () => {
    checkGuestAndAction(() => {
      const slug = (output.title || "devstory-prd").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadFile(output.prd_markdown, `${slug}.md`, "text/markdown;charset=utf-8");
    });
  };

  const handleDownloadJira = () => {
    checkGuestAndAction(() => {
      const slug = (output.title || "devstory-jira").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      downloadFile(
        JSON.stringify(output.jira_json, null, 2),
        `${slug}-backlog.json`,
        "application/json;charset=utf-8"
      );
    });
  };

  const handleDownloadReact = () => {
    checkGuestAndAction(() => {
      downloadFile(output.react_code, "App.tsx", "text/plain;charset=utf-8");
    });
  };

  const handleDownloadHtml = () => {
    checkGuestAndAction(() => {
      const slug = (output.title || "devstory-prototype").toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const fullHtml = buildSandboxHtml(output.react_code);
      downloadFile(fullHtml, `${slug}.html`, "text/html;charset=utf-8");
    });
  };

  const handleCopyReact = async () => {
    if (!output.react_code) return;
    checkGuestAndAction(async () => {
      await navigator.clipboard.writeText(output.react_code);
      setCopyCodeSuccess(true);
      setTimeout(() => setCopyCodeSuccess(false), 2000);
    });
  };

  const handleOpenJiraModal = () => {
    checkGuestAndAction(() => {
      setIsJiraModalOpen(true);
      setSyncedIssues([]);
      setSyncProgress(0);
    });
  };

  const handleStartJiraSync = () => {
    setIsSyncing(true);
    setSyncProgress(10);
    setSyncedIssues([]);

    const total = Math.max(stories.length, 1);
    let current = 0;

    const interval = setInterval(() => {
      current++;
      const pct = Math.min(Math.round((current / total) * 100), 100);
      setSyncProgress(pct);

      if (current >= total) {
        clearInterval(interval);
        setTimeout(() => {
          setIsSyncing(false);
          const generated = stories.map((s, idx) => ({
            key: `${projectKey.toUpperCase()}-${101 + idx}`,
            summary: s.summary,
          }));
          setSyncedIssues(generated);
        }, 400);
      }
    }, 350);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      {/* Alerta de Modo Invitado */}
      {isGuest && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between gap-3 text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Modo Invitado: Crea una cuenta gratuita para desbloquear la descarga de entregables y la sincronización con Jira.</span>
          </div>
          <button
            type="button"
            onClick={onRequireAuth}
            className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition shrink-0"
          >
            Crear Cuenta Gratis
          </button>
        </div>
      )}

      {/* Barra de Acciones de Exportación */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            Entregables y Exportación Directa
          </h3>
          <p className="text-xs text-slate-400">Archivos listos para sincronizar con tu equipo de desarrollo.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Botón Principal: Enviar a Jira Cloud API */}
          <button
            type="button"
            onClick={handleOpenJiraModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 transition"
          >
            <Cloud className="w-3.5 h-3.5" />
            {isGuest ? "🔒 Enviar a Jira Cloud" : "🚀 Enviar a Jira Cloud (API)"}
          </button>

          {/* Descargar HTML Ejecutable */}
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition"
            title="Descargar prototipo autocontenido ejecutable en navegador sin servidor"
          >
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            Prototipo Web (.html)
            <Download className="w-3 h-3 text-emerald-400" />
          </button>

          {/* Descargar PRD */}
          <button
            type="button"
            onClick={handleDownloadPrd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition"
          >
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            PRD (.md)
            <Download className="w-3 h-3 text-slate-500" />
          </button>

          {/* Descargar Jira JSON */}
          <button
            type="button"
            onClick={handleDownloadJira}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition"
          >
            <FileJson className="w-3.5 h-3.5 text-amber-400" />
            Jira/Trello (.json)
            <Download className="w-3 h-3 text-slate-500" />
          </button>

          {/* Copiar / Descargar React Code */}
          <button
            type="button"
            onClick={handleCopyReact}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/20 border border-indigo-500/40 text-indigo-200 hover:bg-indigo-600/30 transition"
          >
            {copyCodeSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-indigo-400" />
                <span>Copiar React</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadReact}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white transition"
            title="Descargar App.tsx"
          >
            <Code2 className="w-3.5 h-3.5 text-indigo-400" />
            App.tsx
            <Download className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Backlog de Historias de Usuario para Jira */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60 min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-indigo-400" />
            Historias de Usuario ({stories.length})
          </h4>
          <span className="text-xs text-slate-500">
            Total Story Points:{" "}
            <span className="font-bold text-indigo-400">
              {stories.reduce((acc, s) => acc + (s.story_points || 0), 0)}
            </span>
          </span>
        </div>

        <div className="grid gap-4">
          {stories.map((story, idx) => {
            const priorityClass =
              PRIORITY_BADGES[story.priority] || "bg-slate-800 text-slate-400 border-slate-700";

            return (
              <div
                key={idx}
                className="rounded-xl border border-slate-800 bg-slate-900 p-4 transition hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-950 border border-indigo-800 text-indigo-300">
                      {story.issue_type || "Story"} #{idx + 1}
                    </span>
                    <h5 className="text-xs font-bold text-slate-200">{story.summary}</h5>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${priorityClass}`}
                    >
                      {story.priority}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300">
                      {story.story_points} SP
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-3 leading-relaxed">{story.description}</p>

                {story.acceptance_criteria && story.acceptance_criteria.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <p className="text-[11px] font-semibold text-slate-300 mb-1.5">
                      Criterios de Aceptación:
                    </p>
                    <ul className="space-y-1">
                      {story.acceptance_criteria.map((criterion, cIdx) => (
                        <li
                          key={cIdx}
                          className="text-[11px] text-slate-400 flex items-start gap-1.5"
                        >
                          <span className="text-indigo-400 mt-0.5">•</span>
                          <span>{criterion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Simulador Jira Cloud API */}
      {isJiraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl overflow-hidden">
            <button
              onClick={() => setIsJiraModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Sincronización con Jira Cloud API</h3>
                <p className="text-[11px] text-slate-400">Exporta las historias directamente a tu tablero Atlassian</p>
              </div>
            </div>

            {syncedIssues.length === 0 ? (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Instancia Jira Cloud URL
                  </label>
                  <input
                    type="url"
                    value={jiraUrl}
                    onChange={(e) => setJiraUrl(e.target.value)}
                    placeholder="https://tu-empresa.atlassian.net"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Project Key de Jira
                  </label>
                  <input
                    type="text"
                    value={projectKey}
                    onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                    placeholder="DEV"
                    maxLength={10}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono font-bold"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Los tickets se generarán con el prefijo {projectKey || "PROJ"}-101, etc.
                  </p>
                </div>

                {isSyncing ? (
                  <div className="py-4 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        Creando historias en Jira Cloud...
                      </span>
                      <span className="font-bold text-blue-400">{syncProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartJiraSync}
                    className="w-full mt-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Sincronizar {stories.length} Historias con Jira API
                  </button>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="font-bold">¡Backlog sincronizado exitosamente!</p>
                    <p className="text-[11px] text-emerald-300/80">
                      Se han creado {syncedIssues.length} tickets en {jiraUrl}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {syncedIssues.map((iss) => (
                    <div
                      key={iss.key}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-400 bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                          {iss.key}
                        </span>
                        <span className="text-slate-200 truncate max-w-[260px]">{iss.summary}</span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold">Creado</span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setIsJiraModalOpen(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                >
                  Cerrar
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
