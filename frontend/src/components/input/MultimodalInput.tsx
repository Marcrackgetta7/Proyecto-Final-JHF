"use client";

import { useEffect, useRef, useState } from "react";
import {
  FileAudio,
  FolderUp,
  ImageIcon,
  Loader2,
  Mic,
  PenTool,
  RotateCcw,
  Sparkles,
  StopCircle,
  Trash2,
  UploadCloud,
} from "lucide-react";
import SketchCanvas from "./SketchCanvas";

export interface GeneratePayload {
  promptText: string;
  sketchFile: File | null;
  audioBlob: Blob | null;
  modelTier: "flash" | "pro";
}

interface MultimodalInputProps {
  onGenerate: (payload: GeneratePayload) => void | Promise<void>;
  isLoading?: boolean;
  userPlan?: "free" | "pro";
  onRequirePro?: () => void;
}

export default function MultimodalInput({
  onGenerate,
  isLoading = false,
  userPlan = "free",
  onRequirePro,
}: MultimodalInputProps) {
  const [promptText, setPromptText] = useState("");
  const [modelTier, setModelTier] = useState<"flash" | "pro">("flash");

  // Si el usuario cambia a PRO desde afuera, sincronizar
  useEffect(() => {
    if (userPlan === "pro") {
      setModelTier("pro");
    }
  }, [userPlan]);

  // Imagen / Boceto
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [sketchPreview, setSketchPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<"upload" | "canvas">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio / Grabadora
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  // Manejo de preview de imagen
  useEffect(() => {
    if (!sketchFile) {
      setSketchPreview(null);
      return;
    }
    const url = URL.createObjectURL(sketchFile);
    setSketchPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [sketchFile]);

  // Manejo de preview de audio
  useEffect(() => {
    if (!audioBlob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioBlob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioBlob]);

  // Limpiar temporizador de grabación al desmontar
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Drag & drop de imagen
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        setSketchFile(file);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSketchFile(e.target.files[0]);
    }
  };

  // Grabación de voz nativa
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || "audio/webm";
        const combinedBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(combinedBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error al acceder al micrófono:", err);
      alert("No se pudo acceder al micrófono. Por favor verifica los permisos del navegador o sube un archivo de audio.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAudioBlob(file);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingSeconds(0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim() && !sketchFile && !audioBlob) {
      alert("Por favor ingresa requerimientos en texto, un boceto o una nota de voz.");
      return;
    }
    onGenerate({
      promptText,
      sketchFile,
      audioBlob,
      modelTier,
    });
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl">
      {/* Selector de modelo / Tier */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Entrada Multimodal
          </h2>
          <p className="text-xs text-slate-400">Combina notas de voz, dibujos y texto.</p>
        </div>
        <div className="w-full sm:w-auto grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setModelTier("flash")}
            className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg transition-all text-center ${
              modelTier === "flash"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Gemini 3.8 Flash
          </button>
          <button
            type="button"
            onClick={() => {
              if (userPlan === "free") {
                onRequirePro?.();
              } else {
                setModelTier("pro");
              }
            }}
            className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              modelTier === "pro"
                ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Gemini 3.8 Pro</span>
            {userPlan === "free" && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">
                PRO
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Entrada de Boceto: Subir Archivo vs Pizarra Digital */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-2">
          <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
            Boceto de Arquitectura / Interfaz
          </label>

          {!sketchPreview && (
            <div className="w-full sm:w-auto grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setImageInputMode("upload")}
                className={`w-full py-1.5 px-2.5 text-[11px] font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                  imageInputMode === "upload"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <FolderUp className="w-3 h-3" />
                <span>📁 Subir Foto</span>
              </button>
              <button
                type="button"
                onClick={() => setImageInputMode("canvas")}
                className={`w-full py-1.5 px-2.5 text-[11px] font-medium rounded-lg transition flex items-center justify-center gap-1.5 ${
                  imageInputMode === "canvas"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <PenTool className="w-3 h-3" />
                <span>✏️ Pizarra</span>
              </button>
            </div>
          )}
        </div>

        {sketchPreview ? (
          <div className="relative rounded-xl border border-slate-700 bg-slate-950 p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sketchPreview}
                alt="Vista previa del boceto"
                className="w-16 h-16 rounded-lg object-cover border border-slate-800 bg-white"
              />
              <div>
                <p className="text-xs font-medium text-slate-200 truncate max-w-[220px]">
                  {sketchFile?.name}
                </p>
                <p className="text-[11px] text-slate-400">
                  {sketchFile ? `${(sketchFile.size / 1024 / 1024).toFixed(2)} MB` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSketchFile(null);
                setImageInputMode("upload");
              }}
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
              title="Quitar boceto"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : imageInputMode === "canvas" ? (
          <SketchCanvas
            onSaveSketch={(file) => {
              setSketchFile(file);
              setImageInputMode("upload");
            }}
            onCancel={() => setImageInputMode("upload")}
          />
        ) : (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
              isDragging
                ? "border-indigo-500 bg-indigo-950/20"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*"
              className="hidden"
            />
            <UploadCloud className="w-7 h-7 mx-auto mb-2 text-slate-500" />
            <p className="text-xs text-slate-300 font-medium">
              Arrastra tu boceto o <span className="text-indigo-400 underline">haz clic para examinar</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Dibuja en papel, pizarra o tableta y súbelo aquí</p>
          </div>
        )}
      </div>

      {/* Grabador de Notas de Voz */}
      <div>
        <label className="text-xs font-medium text-slate-300 block mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            Nota de voz en español
          </span>
          <span className="text-[11px] text-slate-500">Micrófono directo o archivo .mp3/.wav/.webm</span>
        </label>

        {audioUrl ? (
          <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300 flex items-center gap-2">
                <FileAudio className="w-4 h-4 text-emerald-400" />
                Nota de voz lista
              </span>
              <button
                type="button"
                onClick={clearAudio}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
                title="Descartar audio"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <audio src={audioUrl} controls className="w-full h-9 rounded-lg" />
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {isRecording ? (
              <div className="flex-1 flex items-center justify-between rounded-xl border border-rose-500/50 bg-rose-950/30 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-bold text-rose-300">Grabando...</span>
                  <span className="text-xs font-mono text-slate-300 ml-2">
                    {formatTimer(recordingSeconds)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition"
                >
                  <StopCircle className="w-3.5 h-3.5" /> Detener
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 text-slate-300 hover:text-white text-xs font-medium transition"
                >
                  <Mic className="w-4 h-4 text-indigo-400" />
                  Grabar Nota de Voz
                </button>
                <input
                  type="file"
                  ref={audioFileInputRef}
                  onChange={handleAudioFileSelect}
                  accept="audio/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => audioFileInputRef.current?.click()}
                  className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-800/80 text-slate-400 hover:text-white transition"
                  title="Subir archivo de audio"
                >
                  <UploadCloud className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Requerimientos en texto */}
      <div>
        <label className="text-xs font-medium text-slate-300 block mb-2">
          Requerimientos y contexto adicional (opcional)
        </label>
        <textarea
          rows={4}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder="Ej: Deseo un dashboard con gráficos semanales, barra lateral colapsable, estados vacío/cargando y paleta oscura..."
          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
        />
      </div>

      {/* Botón de acción */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Orquestando con Gemini {modelTier.toUpperCase()}...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Generar Especificación y Prototipo</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
