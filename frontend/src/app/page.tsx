"use client";

import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Crown,
  FolderGit2,
  Gift,
  Layers,
  LogOut,
  Menu,
  Sparkles,
  User as UserIcon,
  X as CloseIcon,
  Zap,
} from "lucide-react";

import AmbientPlayer from "@/components/audio/AmbientPlayer";
import AuthModal from "@/components/auth/AuthModal";
import MultimodalInput, { type GeneratePayload } from "@/components/input/MultimodalInput";
import ReferralModal from "@/components/modals/ReferralModal";
import UpgradeProModal from "@/components/modals/UpgradeProModal";
import CanvasPreview from "@/components/modules/CanvasPreview";
import DocumentadorPRD from "@/components/modules/DocumentadorPRD";
import Exportador from "@/components/modules/Exportador";
import ProjectsDrawer, { type SavedProject } from "@/components/modules/ProjectsDrawer";
import {
  API_BASE_URL,
  deleteProjectApi,
  fetchProjects,
  refineProject,
  saveEphemeralProject,
  supabase,
} from "@/lib/supabase";
import type { DevStoryOutput } from "@/types/devstory";

type TabOption = "canvas" | "prd" | "export";

export default function HomePage() {
  const [output, setOutput] = useState<DevStoryOutput | null>(null);
  const [activeTab, setActiveTab] = useState<TabOption>("canvas");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modo Invitado Efímero & Límites
  const [isEphemeralGuest, setIsEphemeralGuest] = useState(false);
  const [guestGenerationCount, setGuestGenerationCount] = useState(0);

  // Autenticación & Usuario
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [usedCount, setUsedCount] = useState<number>(0);
  const [extraCredits, setExtraCredits] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modales y Drawers
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"login" | "signup">("login");
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isReferralModalOpen, setIsReferralModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Proyectos
  const [projects, setProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string>("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4500);
  };

  // 1. Inicialización de sesión y listener de autenticación
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user || null);

          if (data.session?.user) {
            const { data: profile } = await supabase
              .from("users")
              .select("plan")
              .eq("id", data.session.user.id)
              .single();
            if (profile?.plan === "pro") {
              setUserPlan("pro");
            }
          }
        }
      } catch (err) {
        console.warn("Error recuperando sesión:", err);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user) {
        const { data: profile } = await supabase
          .from("users")
          .select("plan")
          .eq("id", newSession.user.id)
          .single();
        if (profile?.plan === "pro") {
          setUserPlan("pro");
        }
        loadUserProjects(newSession.user.id, newSession.access_token);

        // Si el usuario era un invitado con un proyecto efímero en memoria, rescatarlo automáticamente
        if (output && isEphemeralGuest) {
          const res = await saveEphemeralProject(output, newSession.user.id, newSession.access_token);
          if (res.ok) {
            setIsEphemeralGuest(false);
            if (res.project_id) {
              setCurrentProjectId(res.project_id);
            }
            showToast("🎉 ¡Tu proyecto temporal ha sido guardado exitosamente en tu cuenta!");
            loadUserProjects(newSession.user.id, newSession.access_token);
          }
        }
      } else {
        setUserPlan("free");
        setProjects([]);
      }
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [output, isEphemeralGuest]);

  // 2. Cargar proyectos de usuario registrado
  const loadUserProjects = async (userId: string, token?: string) => {
    const list = await fetchProjects(userId, token);
    setProjects(list);
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadUserProjects(user.id, session?.access_token);
    }
  }, [user, authLoading]);

  // 4. Generación Principal
  const handleGenerate = async (payload: GeneratePayload) => {
    // Si usuario free intenta pro, interceptar y abrir modal
    if (payload.modelTier === "pro" && userPlan === "free") {
      setIsUpgradeModalOpen(true);
      return;
    }

    // Límite de invitados: solo 1 generación de prueba sin registro
    if (!user && guestGenerationCount >= 1) {
      setAuthModalTab("signup");
      setIsAuthModalOpen(true);
      showToast("🔒 Has alcanzado el límite del modo invitado. Crea tu cuenta gratis para continuar.");
      return;
    }

    if (user && userPlan === "free" && usedCount >= 5 + extraCredits) {
      setIsUpgradeModalOpen(true);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("prompt_text", payload.promptText);
      formData.append("model_tier", payload.modelTier);

      if (user) {
        formData.append("user_id", user.id);
      }
      if (currentProjectId) {
        formData.append("project_id", currentProjectId);
      }
      if (payload.sketchFile) {
        formData.append("sketch", payload.sketchFile);
      }
      if (payload.audioBlob) {
        formData.append("voice", payload.audioBlob, "nota_voz.webm");
      }

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/generate`, {
        method: "POST",
        headers,
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (res.status === 429) {
          setIsUpgradeModalOpen(true);
        }
        throw new Error(errorData.detail || `Error en el servidor: Código ${res.status}`);
      }

      const result = await res.json();

      const storyOutput: DevStoryOutput = {
        title: result.title || "DevStory Output",
        prd_markdown: result.prd_markdown || "",
        jira_json: result.jira_json || [],
        mermaid_diagram: result.mermaid_diagram || "",
        react_code: result.react_code || "",
      };

      setOutput(storyOutput);
      setActiveTab("canvas");

      if (user) {
        setUsedCount((prev) => Math.min(prev + 1, 5 + extraCredits));
        setIsEphemeralGuest(false);
        if (result.project_id) {
          setCurrentProjectId(result.project_id);
        }
        loadUserProjects(user.id, session?.access_token);
      } else {
        // Modo Invitado 100% Efímero en memoria RAM
        setIsEphemeralGuest(true);
        setGuestGenerationCount((prev) => prev + 1);
        setCurrentProjectId("");
      }
    } catch (err: any) {
      console.error("Fallo al generar con DevStory AI:", err);
      setErrorMessage(
        err?.message || "Ocurrió un error inesperado al orquestar la generación con el backend."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // 5. Refinamiento Iterativo con IA
  const handleRefine = async (instruction: string) => {
    if (!output) return;

    if (!user) {
      setAuthModalTab("signup");
      setIsAuthModalOpen(true);
      showToast("🔒 Crea tu cuenta gratis para desbloquear el refinamiento con IA.");
      return;
    }

    setIsRefining(true);
    try {
      const res = await refineProject(
        output,
        instruction,
        user.id,
        currentProjectId || undefined,
        userPlan === "pro" ? "pro" : "flash",
        session?.access_token
      );

      if (!res.ok || !res.data) {
        throw new Error(res.error || "No se pudo refinar el prototipo");
      }

      setOutput(res.data);
      showToast("✨ Prototipo refinado exitosamente con IA.");
      loadUserProjects(user.id, session?.access_token);
    } catch (err: any) {
      setErrorMessage(err?.message || "Error al procesar el refinamiento con IA.");
    } finally {
      setIsRefining(false);
    }
  };

  // 6. Eliminar Proyecto
  const handleDeleteProject = async (projectId: string) => {
    if (!user) return;
    const ok = await deleteProjectApi(projectId, user.id, session?.access_token);
    if (ok) {
      if (currentProjectId === projectId) {
        setOutput(null);
        setCurrentProjectId("");
      }
      showToast("🗑️ Proyecto eliminado con éxito.");
      loadUserProjects(user.id, session?.access_token);
    } else {
      setErrorMessage("No se pudo eliminar el proyecto.");
    }
  };

  const handleSelectSavedProject = (loadedOutput: DevStoryOutput, projId: string) => {
    setOutput(loadedOutput);
    setCurrentProjectId(projId);
    setIsEphemeralGuest(false);
    setActiveTab("canvas");
  };

  // Cerrar Sesión y limpiar toda memoria
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserPlan("free");
    setOutput(null);
    setCurrentProjectId("");
    setProjects([]);
    setIsEphemeralGuest(false);
    setGuestGenerationCount(0);
    showToast("Sesión cerrada. Los datos locales han sido borrados de memoria.");
  };

  const openSignUpModal = () => {
    setAuthModalTab("signup");
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden max-w-[100vw]">
      {/* Navbar Superior */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          {/* Logo / Marca */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 shrink-0">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                  DevStory <span className="text-indigo-400">AI</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 ${
                    userPlan === "pro"
                      ? "bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-300"
                      : "bg-slate-800 border border-slate-700 text-slate-300 hover:border-indigo-500 hover:text-white"
                  }`}
                  title="Haz clic para ver planes"
                >
                  {userPlan === "pro" ? (
                    <>
                      <Crown className="w-3 h-3 text-amber-400" />
                      PRO
                    </>
                  ) : (
                    "FREE"
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Del boceto al código en 30 segundos
              </p>
            </div>
          </div>

          {/* Vista Desktop (>= 768px): Audio, +10 Gratis, Cuota, Proyectos y Auth */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Reproductor Suno AI */}
            <AmbientPlayer />

            {/* Programa de Referidos AIDA */}
            <button
              type="button"
              onClick={() => setIsReferralModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition shadow-sm"
              title="Invita a un colega y obtén +10 generaciones Pro gratis"
            >
              <Gift className="w-3.5 h-3.5 text-emerald-400" />
              <span>🎁 +10 Gratis</span>
            </button>

            {/* Contador de Cuota Free / Pro */}
            <button
              type="button"
              onClick={() => setIsUpgradeModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-800 hover:border-indigo-500 text-slate-300 transition"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>
                {userPlan === "pro" ? (
                  <strong className="text-amber-300">Plan Pro: Ilimitado</strong>
                ) : user ? (
                  <>
                    Plan Free: <strong className="text-indigo-300">{usedCount}/{5 + extraCredits}</strong>
                  </>
                ) : (
                  <>
                    Invitado: <strong className="text-indigo-300">{guestGenerationCount}/1</strong>
                  </>
                )}
              </span>
            </button>

            {/* Botón Historial de Proyectos Drawer */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-200 transition"
              title="Abrir historial de proyectos"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>Proyectos</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 font-bold">
                {projects.length}
              </span>
            </button>

            {/* Autenticación / Usuario */}
            {authLoading ? (
              <div className="w-16 h-8 rounded-xl bg-slate-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-2 pl-1">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md"
                  title={user.email}
                >
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab("login");
                  setIsAuthModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Ingresar</span>
              </button>
            )}
          </div>

          {/* Vista Móvil (< 768px): Proyectos, Auth y Menú Desplegable (Cero Scroll Horizontal) */}
          <div className="flex md:hidden items-center gap-2">
            {/* Botón Proyectos Móvil */}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800 transition"
              title="Historial de Proyectos"
            >
              <FolderGit2 className="w-4 h-4 text-indigo-400" />
              {projects.length > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-indigo-600 text-[10px] font-bold text-white leading-none">
                  {projects.length}
                </span>
              )}
            </button>

            {/* Auth Móvil */}
            {authLoading ? (
              <div className="w-8 h-8 rounded-full bg-slate-800 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-md"
                  title={user.email}
                >
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition"
                  title="Cerrar Sesión"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalTab("login");
                  setIsAuthModalOpen(true);
                }}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
              >
                Ingresar
              </button>
            )}

            {/* Botón Toggle Menú Móvil */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
              aria-label="Abrir menú secundario"
            >
              {isMobileMenuOpen ? (
                <CloseIcon className="w-4 h-4 text-indigo-400" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Panel Desplegable Móvil (< 768px) */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 py-3 space-y-2.5 shadow-2xl animate-in slide-in-from-top-2 duration-150">
            {/* Estado de Cuota con botón Mejorar */}
            <div className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <Zap className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  {userPlan === "pro" ? (
                    <strong className="text-amber-300">Plan Pro: Ilimitado</strong>
                  ) : user ? (
                    <>
                      Plan Free: <strong className="text-indigo-300">{usedCount}/{5 + extraCredits}</strong>
                    </>
                  ) : (
                    <>
                      Invitado: <strong className="text-indigo-300">{guestGenerationCount}/1</strong>
                    </>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUpgradeModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition shadow-sm"
              >
                {userPlan === "pro" ? "Ver Plan" : "Mejorar"}
              </button>
            </div>

            {/* Botón Referidos y Reproductor Focus */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsReferralModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition shadow-sm"
              >
                <Gift className="w-4 h-4 text-emerald-400" />
                <span>🎁 Obtener +10 Gratis</span>
              </button>

              <div className="shrink-0 flex items-center justify-center">
                <AmbientPlayer />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Banner de Advertencia de Modo Invitado Efímero */}
      {isEphemeralGuest && output && (
        <div className="bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-amber-600/20 border-b border-amber-500/30 px-4 py-2.5 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>⚠️ Modo Invitado Temporal:</strong> Si recargas o sales de la página, este proyecto se borrará definitivamente. Crea una cuenta gratis para guardarlo y exportarlo.
              </span>
            </div>
            <button
              type="button"
              onClick={openSignUpModal}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition text-xs shadow-md shadow-amber-500/20 shrink-0"
            >
              Crear Cuenta y Guardar
            </button>
          </div>
        </div>
      )}

      {/* Alerta de Error */}
      {errorMessage && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4">
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Workspace Principal en 2 Columnas */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda: Entrada Multimodal */}
        <section className="lg:col-span-5 min-w-0 flex flex-col gap-4">
          <MultimodalInput
            onGenerate={handleGenerate}
            isLoading={isLoading}
            userPlan={userPlan}
            onRequirePro={() => setIsUpgradeModalOpen(true)}
          />
        </section>

        {/* Columna Derecha: Tabs con los 3 Módulos de Entrega */}
        <section className="lg:col-span-7 min-w-0 flex flex-col h-full">
          {/* Navegación por pestañas */}
          <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 mb-4 shadow-lg overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab("canvas")}
              className={`flex-1 shrink-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "canvas"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              1. Prototipo en Vivo
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("prd")}
              className={`flex-1 shrink-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "prd"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              2. PRD & Arquitectura
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("export")}
              className={`flex-1 shrink-0 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "export"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              3. Jira & Exportación
            </button>
          </div>

          {/* Contenido de la Pestaña Activa */}
          <div className="flex-1 min-w-0">
            {activeTab === "canvas" && (
              <CanvasPreview
                reactCode={output ? output.react_code : ""}
                onCodeChange={(newCode) => {
                  setOutput((prev) => (prev ? { ...prev, react_code: newCode } : null));
                }}
                onRefine={handleRefine}
                isRefining={isRefining}
                isGuest={!user}
                onRequireAuth={openSignUpModal}
              />
            )}
            {activeTab === "prd" && (
              <DocumentadorPRD
                prdMarkdown={output ? output.prd_markdown : ""}
                mermaidDiagram={output ? output.mermaid_diagram : ""}
              />
            )}
            {activeTab === "export" && (
              <Exportador
                output={output}
                isGuest={!user}
                onRequireAuth={openSignUpModal}
              />
            )}
          </div>
        </section>
      </main>

      {/* Modales y Drawers */}
      <AuthModal
        isOpen={isAuthModalOpen}
        initialTab={authModalTab}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          if (user) loadUserProjects(user.id, session?.access_token);
        }}
      />

      <UpgradeProModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        userId={user?.id}
        token={session?.access_token}
        onUpgraded={() => {
          setUserPlan("pro");
          showToast("🎉 ¡Plan Pro activado exitosamente!");
        }}
      />

      <ReferralModal
        isOpen={isReferralModalOpen}
        onClose={() => setIsReferralModalOpen(false)}
        userId={user?.id}
        onAddCredits={(credits) => {
          setExtraCredits((prev) => prev + credits);
          showToast(`🎉 ¡Referido exitoso! Se han añadido +${credits} generaciones a tu cuenta.`);
        }}
      />

      {/* Notificación Toast Flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-slate-900/95 border border-indigo-500/80 text-indigo-100 text-xs shadow-2xl shadow-indigo-950/80 flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 max-w-md">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-white ml-2 text-sm font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <ProjectsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        projects={projects}
        currentProjectId={currentProjectId}
        onSelectProject={handleSelectSavedProject}
        onDeleteProject={handleDeleteProject}
        isGuest={!user}
        onRequireAuth={openSignUpModal}
        onNewProject={() => {
          setOutput(null);
          setCurrentProjectId("");
          setIsEphemeralGuest(false);
        }}
      />

      {/* Footer Minimalista */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        DevStory AI — Impulsado por Google Gemini 2.5 y Supabase. Costo de infraestructura $0 USD.
      </footer>
    </div>
  );
}
