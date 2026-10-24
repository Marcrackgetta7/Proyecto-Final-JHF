"use client";

import { useState } from "react";
import { Check, Crown, Loader2, Sparkles, X, Zap } from "lucide-react";
import { requestUpgradePlan } from "@/lib/supabase";

interface UpgradeProModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  token?: string;
  onUpgraded?: () => void;
}

export default function UpgradeProModal({
  isOpen,
  onClose,
  userId,
  token,
  onUpgraded,
}: UpgradeProModalProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleActivateTrial = async () => {
    setLoading(true);
    try {
      if (userId) {
        await requestUpgradePlan(userId, token, "pro");
      }
      onUpgraded?.();
      onClose();
    } catch (err) {
      console.warn("Error activando trial:", err);
      onUpgraded?.();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-[95vw] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-8 shadow-2xl">
        {/* Glow de fondo */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado Embudo AIDA */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-950 border border-indigo-800/80 text-indigo-300 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Potencia tu Flujo de Ingeniería
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Desbloquea el Poder Total de <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">DevStory Pro</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mt-2">
            Delega la arquitectura completa, razonamiento multimodal profundo y exportaciones directas sin restricciones de cuota.
          </p>
        </div>

        {/* Grilla Comparativa */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Plan Free */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Plan Free
                </span>
                <span className="text-lg font-bold text-slate-200">$0 /mes</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-4">Para pruebas rápidas y prototipos iniciales.</p>

              <ul className="space-y-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Hasta 2 proyectos gratis</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Modelo Gemini 3.8 Flash</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Análisis de bocetos e imágenes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Descarga de PRD en Markdown</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <span className="text-[11px] font-semibold text-slate-500">Plan actual activo</span>
            </div>
          </div>

          {/* Plan Pro */}
          <div className="relative rounded-2xl border-2 border-indigo-500/80 bg-gradient-to-b from-slate-900 to-indigo-950/40 p-5 flex flex-col justify-between shadow-xl shadow-indigo-950/50">
            <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md">
              Recomendado
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-amber-400" />
                  Plan Pro
                </span>
                <div>
                  <span className="text-xl font-black text-white">$19.99</span>
                  <span className="text-xs text-slate-400"> /mes</span>
                </div>
              </div>
              <p className="text-[11px] text-indigo-200/70 mb-4">Para Tech Leads, Founders y Agencias B2B.</p>

              <ul className="space-y-2 text-xs text-slate-100">
                <li className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-semibold text-white">Proyectos ilimitados</span>
                </li>
                <li className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Modelo Gemini 3.8 Pro (Razonamiento profundo)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Notas de voz continuas en español</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Exportación directa a Jira / Trello vía API</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Descarga de componentes React + Tailwind CSS</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-4">
              <button
                type="button"
                onClick={handleActivateTrial}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/40 flex items-center justify-center gap-2 transition disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Crown className="w-4 h-4 text-amber-300" />
                    <span>Activar Prueba Gratuita de 14 Días</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-center text-slate-500">
          Sin compromisos. Cancela en cualquier momento desde tu panel de usuario.
        </p>
      </div>
    </div>
  );
}
