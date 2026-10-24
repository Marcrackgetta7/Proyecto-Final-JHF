"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Eraser,
  Pen,
  Square,
  Trash2,
} from "lucide-react";

interface SketchCanvasProps {
  onSaveSketch: (file: File) => void;
  onCancel?: () => void;
}

type Tool = "pen" | "rect" | "eraser";

export default function SketchCanvas({ onSaveSketch, onCancel }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState<string>("#0f172a"); // Lápiz oscuro de alto contraste
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  // Redibujar cuadrícula base suave
  const drawBaseGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "#f1f5f9";
    ctx.lineWidth = 1;
    for (let x = 20; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 20; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  };

  // Inicialización del canvas con ResizeObserver y DevicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.floor(rect.width);
      const targetHeight = 380;

      if (targetWidth <= 0) return;

      // Guardar contenido anterior si existe
      let prevImage: HTMLImageElement | null = null;
      if (canvas.width > 0 && canvas.height > 0) {
        try {
          const dataUrl = canvas.toDataURL();
          prevImage = new Image();
          prevImage.src = dataUrl;
        } catch {}
      }

      canvas.width = Math.floor(targetWidth * dpr);
      canvas.height = Math.floor(targetHeight * dpr);
      canvas.style.width = `${targetWidth}px`;
      canvas.style.height = `${targetHeight}px`;

      ctx.resetTransform?.();
      ctx.scale(dpr, dpr);

      drawBaseGrid(ctx, targetWidth, targetHeight);

      if (prevImage) {
        prevImage.onload = () => {
          ctx.drawImage(prevImage!, 0, 0, targetWidth, targetHeight);
        };
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);
    setIsDrawing(true);
    setStartPos(coords);

    const currentSnap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setSnapshot(currentSnap);

    if (tool === "pen" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? lineWidth * 4 : lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    if ("touches" in e) {
      e.preventDefault();
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const coords = getCanvasCoords(e);

    if (tool === "pen" || tool === "eraser") {
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineWidth = tool === "eraser" ? lineWidth * 4 : lineWidth;
      ctx.lineTo(coords.x, coords.y);
      ctx.stroke();
    } else if (tool === "rect" && startPos && snapshot) {
      ctx.putImageData(snapshot, 0, 0);

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.strokeRect(
        startPos.x,
        startPos.y,
        coords.x - startPos.x,
        coords.y - startPos.y
      );
      ctx.restore();
    }
  };

  const stopDraw = () => {
    setIsDrawing(false);
    setStartPos(null);
    setSnapshot(null);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);
    drawBaseGrid(ctx, rect.width, rect.height);
  };

  const handleUseSketch = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `pizarra-boceto-${Date.now()}.png`, {
        type: "image/png",
      });
      onSaveSketch(file);
    }, "image/png");
  };

  return (
    <div className="flex flex-col rounded-2xl bg-slate-950 border border-slate-800 p-3 overflow-hidden">
      {/* Barra de Herramientas de la Pizarra */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-800">
        {/* Selector de herramienta */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setTool("pen")}
            className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
              tool === "pen"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Lápiz"
          >
            <Pen className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTool("rect")}
            className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
              tool === "rect"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Caja / Rectángulo para maquetar"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTool("eraser")}
            className={`p-1.5 rounded-lg text-xs transition flex items-center gap-1 ${
              tool === "eraser"
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Borrador"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Colores */}
        {tool !== "eraser" && (
          <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setColor("#0f172a")}
              className={`w-4 h-4 rounded-full bg-slate-900 border border-slate-600 transition ${
                color === "#0f172a" ? "ring-2 ring-indigo-500 scale-110" : ""
              }`}
              title="Negro"
            />
            <button
              type="button"
              onClick={() => setColor("#2563eb")}
              className={`w-4 h-4 rounded-full bg-blue-600 transition ${
                color === "#2563eb" ? "ring-2 ring-indigo-500 scale-110" : ""
              }`}
              title="Azul"
            />
            <button
              type="button"
              onClick={() => setColor("#dc2626")}
              className={`w-4 h-4 rounded-full bg-red-600 transition ${
                color === "#dc2626" ? "ring-2 ring-indigo-500 scale-110" : ""
              }`}
              title="Rojo"
            />
          </div>
        )}

        {/* Grosor */}
        <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setLineWidth(2)}
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              lineWidth === 2 ? "bg-indigo-600 text-white" : "text-slate-400"
            }`}
          >
            Fino
          </button>
          <button
            type="button"
            onClick={() => setLineWidth(4)}
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              lineWidth === 4 ? "bg-indigo-600 text-white" : "text-slate-400"
            }`}
          >
            Medio
          </button>
          <button
            type="button"
            onClick={() => setLineWidth(7)}
            className={`px-1.5 py-0.5 text-[10px] rounded ${
              lineWidth === 7 ? "bg-indigo-600 text-white" : "text-slate-400"
            }`}
          >
            Grueso
          </button>
        </div>

        {/* Acciones de Pizarra */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={clearCanvas}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-900 transition"
            title="Limpiar pizarra"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contenedor del Lienzo */}
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden shadow-inner border border-slate-800 relative cursor-crosshair bg-white touch-none"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          className="block w-full h-[380px] touch-none"
        />
      </div>

      {/* Botones inferiores */}
      <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-800">
        <span className="text-[11px] text-slate-500">
          Dibuja cajas, menús y botones como lo harías en papel.
        </span>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white transition"
            >
              Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleUseSketch}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition"
          >
            <Check className="w-3.5 h-3.5" />
            Usar este Boceto
          </button>
        </div>
      </div>
    </div>
  );
}
