"use client";

import { useState } from "react";
import {
  Folder,
  FolderGit2,
  FolderOpen,
  Lock,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { DevStoryOutput } from "@/types/devstory";

export interface SavedProject {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  generations?: Array<{
    id: string;
    title?: string;
    prd_markdown?: string;
    mermaid_diagram?: string;
    jira_json?: any;
    react_code?: string;
    created_at?: string;
  }>;
}

interface ProjectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projects: SavedProject[];
  onSelectProject: (output: DevStoryOutput, projectId: string) => void;
  onNewProject: () => void;
  onDeleteProject?: (projectId: string) => Promise<void>;
  currentProjectId?: string;
  isGuest?: boolean;
  onRequireAuth?: () => void;
}

export default function ProjectsDrawer({
  isOpen,
  onClose,
  projects,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  currentProjectId,
  isGuest = false,
  onRequireAuth,
}: ProjectsDrawerProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePickProject = (proj: SavedProject) => {
    // Buscar la última generación en el proyecto
    const latestGen =
      proj.generations && proj.generations.length > 0
        ? proj.generations[proj.generations.length - 1]
        : null;

    if (latestGen) {
      const output: DevStoryOutput = {
        title: latestGen.title || proj.name,
        prd_markdown: latestGen.prd_markdown || "",
        jira_json: Array.isArray(latestGen.jira_json) ? latestGen.jira_json : [],
        mermaid_diagram: latestGen.mermaid_diagram || "",
        react_code: latestGen.react_code || "",
      };
      onSelectProject(output, proj.id);
    } else {
      // Si el proyecto no tiene generaciones guardadas aún
      const emptyOutput: DevStoryOutput = {
        title: proj.name,
        prd_markdown: `# ${proj.name}\n\nProyecto cargado sin generaciones previas.`,
        jira_json: [],
        mermaid_diagram: "graph TD\n  Inicio --> Fin",
        react_code: "",
      };
      onSelectProject(emptyOutput, proj.id);
    }
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, proj: SavedProject) => {
    e.stopPropagation();
    if (!onDeleteProject) return;
    const ok = window.confirm(`¿Estás seguro de eliminar el proyecto "${proj.name}"? Esta acción no se puede deshacer.`);
    if (!ok) return;

    try {
      setDeletingId(proj.id);
      await onDeleteProject(proj.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 shadow-2xl flex flex-col justify-between overflow-y-auto">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <FolderGit2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Historial de Proyectos</h3>
                <p className="text-[11px] text-slate-400">Tus especificaciones y prototipos guardados</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Banner de Modo Invitado */}
          {isGuest && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
              <div className="flex items-start gap-2">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p>Estás navegando en modo invitado. Los proyectos generados son efímeros y no se guardan en el servidor.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequireAuth?.();
                }}
                className="w-full py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs"
              >
                Crear Cuenta para Guardar Proyectos
              </button>
            </div>
          )}

          {/* Botón Nuevo Proyecto */}
          <button
            onClick={() => {
              onNewProject();
              onClose();
            }}
            className="w-full mb-4 py-2.5 px-3 rounded-xl border border-dashed border-indigo-500/50 bg-indigo-950/20 hover:bg-indigo-950/40 text-indigo-300 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Iniciar Nuevo Proyecto
          </button>

          {/* Lista de Proyectos */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {projects.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Folder className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">
                  {isGuest ? "Inicia sesión para sincronizar tu historial." : "No hay proyectos guardados todavía."}
                </p>
                <p className="text-[11px] text-slate-600 mt-1">
                  Genera tu primer prototipo para que aparezca aquí.
                </p>
              </div>
            ) : (
              projects.map((proj) => {
                const isSelected = proj.id === currentProjectId;
                const genCount = proj.generations?.length || 0;
                const dateStr = new Date(proj.created_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "short",
                });
                const isDeleting = deletingId === proj.id;

                return (
                  <div
                    key={proj.id}
                    onClick={() => handlePickProject(proj)}
                    className={`group p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? "border-indigo-500/80 bg-indigo-950/30 text-white"
                        : "border-slate-800/80 bg-slate-950/50 hover:border-slate-700 text-slate-300"
                    } ${isDeleting ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen
                        className={`w-4 h-4 shrink-0 ${isSelected ? "text-indigo-400" : "text-slate-500"}`}
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold truncate max-w-[190px]">{proj.name}</h4>
                        <p className="text-[10px] text-slate-500">
                          {dateStr} • {genCount} {genCount === 1 ? "generación" : "generaciones"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isSelected && (
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
                          Activo
                        </span>
                      )}

                      {/* Botón Eliminar Proyecto */}
                      {onDeleteProject && !isGuest && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, proj)}
                          disabled={isDeleting}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                          title="Eliminar proyecto permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-500 text-center flex items-center justify-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          Sincronizado en tiempo real con Supabase PostgreSQL
        </div>
      </div>
    </div>
  );
}
