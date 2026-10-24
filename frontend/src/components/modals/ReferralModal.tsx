"use client";

import { useState } from "react";
import { Check, Copy, Gift, Sparkles, Users, X, Zap } from "lucide-react";

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
  onAddCredits: (credits: number) => void;
}

export default function ReferralModal({
  isOpen,
  onClose,
  userId,
  onAddCredits,
}: ReferralModalProps) {
  const [copied, setCopied] = useState(false);
  const [claimed, setClaimed] = useState(false);

  if (!isOpen) return null;

  const referralCode = userId ? userId.slice(0, 8) : "dev-free";
  const referralUrl = `https://devstory.app/?ref=${referralCode}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateReferral = () => {
    onAddCredits(10);
    setClaimed(true);
    setTimeout(() => {
      setClaimed(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-[95vw] max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-5 sm:p-7 shadow-2xl">
        {/* Glow de fondo */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Encabezado AIDA - Etapa Fidelizar */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white mx-auto mb-3 shadow-lg shadow-emerald-500/25">
            <Gift className="w-6 h-6" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
            Programa de Referidos B2B
          </span>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-1">
            Invita a un Desarrollador y Gana <span className="text-emerald-400">+10 Créditos Pro</span>
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2">
            Por cada colega o equipo que cree una cuenta con tu enlace, ambos reciben 10 generaciones Pro gratuitas con Gemini 2.5.
          </p>
        </div>

        {/* Enlace de Referido */}
        <div className="mb-6">
          <label className="text-xs font-semibold text-slate-300 block mb-1.5">
            Tu enlace de invitación único
          </label>
          <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-800 bg-slate-950">
            <input
              type="text"
              readOnly
              value={referralUrl}
              className="flex-1 bg-transparent px-2.5 py-1 text-xs text-slate-200 focus:outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Estadísticas de Referidos */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Colegas Unidos</span>
            </div>
            <p className="text-lg font-bold text-white">0 desarrolladores</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              <span>Generaciones Extra</span>
            </div>
            <p className="text-lg font-bold text-emerald-400">+10 por referido</p>
          </div>
        </div>

        {/* Verificación de invitación */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleSimulateReferral}
            disabled={claimed}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition disabled:opacity-60"
          >
            {claimed ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>¡Créditos acreditados con éxito!</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Verificar Invitación (+10 créditos)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
