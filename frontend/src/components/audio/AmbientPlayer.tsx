"use client";

import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Volume2, VolumeX } from "lucide-react";

export default function AmbientPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [usingSynth, setUsingSynth] = useState(false);
  const [showVolume, setShowVolume] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const oscillatorsRef = useRef<OscillatorNode[]>([]);

  useEffect(() => {
    // Inicializar elemento de audio HTML5
    const audio = new Audio("/audio/suno-ambient.mp3");
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    audio.onerror = () => {
      console.info("Archivo /audio/suno-ambient.mp3 no disponible (404). Se activará el sintetizador Web Audio nativo.");
      setUsingSynth(true);
    };

    return () => {
      audio.pause();
      stopSynth();
    };
  }, []);

  const startSynth = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(isMuted ? 0 : volume * 0.15, ctx.currentTime);
      gain.connect(ctx.destination);
      gainNodeRef.current = gain;

      // Filtro pasa-bajos cálido para efecto lo-fi ambiente
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(360, ctx.currentTime);
      filter.connect(gain);

      // Oscilador 1: Onda Senoidal A2 (110 Hz)
      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(110, ctx.currentTime);
      osc1.connect(filter);

      // Oscilador 2: Onda Triangular E3 (164.8 Hz) para armonía sutil
      const osc2 = ctx.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(164.81, ctx.currentTime);
      osc2.connect(filter);

      // Oscilador 3: C#4 (277.18 Hz) suave
      const osc3 = ctx.createOscillator();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(277.18, ctx.currentTime);
      osc3.connect(filter);

      osc1.start();
      osc2.start();
      osc3.start();

      oscillatorsRef.current = [osc1, osc2, osc3];
    } catch (err) {
      console.warn("No se pudo iniciar el sintetizador Web Audio:", err);
    }
  };

  const stopSynth = () => {
    oscillatorsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    oscillatorsRef.current = [];

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const togglePlay = async () => {
    if (isPlaying) {
      if (audioRef.current && !usingSynth) {
        audioRef.current.pause();
      }
      stopSynth();
      setIsPlaying(false);
    } else {
      if (!usingSynth && audioRef.current) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          // Si el audio falla (bloqueo o 404), fallback inmediato al sintetizador
          setUsingSynth(true);
          startSynth();
          setIsPlaying(true);
        }
      } else {
        startSynth();
        setIsPlaying(true);
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        isMuted ? 0 : newVolume * 0.15,
        audioContextRef.current.currentTime
      );
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        nextMuted ? 0 : volume * 0.15,
        audioContextRef.current.currentTime
      );
    }
  };

  return (
    <div className="relative flex items-center">
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900 border border-slate-800 text-slate-300">
        <button
          type="button"
          onClick={togglePlay}
          className="flex items-center gap-1.5 hover:text-white transition"
          title={isPlaying ? "Pausar música ambiente" : "Activar música ambiente Suno AI"}
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400" />
              <span className="hidden sm:inline text-indigo-300 font-semibold">Focus Activo</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Modo Focus</span>
            </>
          )}
        </button>

        {isPlaying && (
          <button
            type="button"
            onClick={toggleMute}
            onMouseEnter={() => setShowVolume(true)}
            className="p-1 hover:text-white transition text-slate-400"
            title={isMuted ? "Reactivar sonido" : "Silenciar"}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            )}
          </button>
        )}
      </div>

      {/* Control deslizante flotante de volumen */}
      {showVolume && isPlaying && (
        <div
          onMouseLeave={() => setShowVolume(false)}
          className="absolute top-8 right-0 mt-2 p-2 bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex items-center gap-2 z-50 animate-in fade-in duration-150"
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      )}
    </div>
  );
}
