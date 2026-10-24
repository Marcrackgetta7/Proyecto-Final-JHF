"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Copy, Download, FileText, GitBranch } from "lucide-react";

interface DocumentadorPRDProps {
  prdMarkdown: string;
  mermaidDiagram: string;
}

export default function DocumentadorPRD({ prdMarkdown, mermaidDiagram }: DocumentadorPRDProps) {
  const [activeTab, setActiveTab] = useState<"prd" | "mermaid">("prd");
  const [copied, setCopied] = useState(false);
  const [mermaidSvg, setMermaidSvg] = useState<string | null>(null);
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Renderizado dinámico seguro de Mermaid en el cliente (SSR-safe)
  useEffect(() => {
    let isMounted = true;

    async function renderMermaid() {
      if (!mermaidDiagram || !mermaidDiagram.trim()) {
        setMermaidSvg(null);
        setMermaidError(null);
        return;
      }

      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          securityLevel: "loose",
          themeVariables: {
            darkMode: true,
            background: "#090d16",
            primaryColor: "#4f46e5",
            primaryTextColor: "#ffffff",
            lineColor: "#6366f1",
          },
        });

        // Limpiar código de delimitadores si aún los tuviese
        let cleanChart = mermaidDiagram.trim();
        if (cleanChart.startsWith("```")) {
          cleanChart = cleanChart.replace(/^```[a-zA-Z]*\n?/, "");
        }
        if (cleanChart.endsWith("```")) {
          cleanChart = cleanChart.replace(/\n?```$/, "");
        }

        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setMermaidSvg(svg);
          setMermaidError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn("Mermaid render error:", err);
          setMermaidError(err?.message || "No se pudo compilar el diagrama visual.");
        }
      }
    }

    renderMermaid();

    return () => {
      isMounted = false;
    };
  }, [mermaidDiagram]);

  const handleCopy = async () => {
    const textToCopy = activeTab === "prd" ? prdMarkdown : mermaidDiagram;
    if (!textToCopy) return;
    await navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSvg = () => {
    if (!mermaidSvg) return;
    const blob = new Blob([mermaidSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "devstory-architecture.svg";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full rounded-2xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden">
      {/* Barra de cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-950 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("prd")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === "prd"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Especificación PRD
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("mermaid")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              activeTab === "mermaid"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            Arquitectura (Mermaid)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "mermaid" && mermaidSvg && (
            <button
              type="button"
              onClick={handleDownloadSvg}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/30 transition"
              title="Descargar diagrama vectorial SVG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar SVG</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={activeTab === "prd" ? !prdMarkdown : !mermaidDiagram}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition disabled:opacity-40"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copiado</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar {activeTab.toUpperCase()}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="flex-1 p-6 overflow-y-auto bg-slate-950/60 min-h-[540px]">
        {activeTab === "prd" ? (
          prdMarkdown ? (
            <div className="prose prose-invert prose-indigo max-w-none text-slate-200 prose-headings:text-slate-100 prose-headings:font-bold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-xs prose-p:leading-relaxed prose-li:text-xs">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {prdMarkdown}
              </ReactMarkdown>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 my-auto h-full">
              <FileText className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
              <p className="text-sm font-medium text-slate-300">Documento PRD Pendiente</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                La especificación detallada con historias de usuario y criterios de aceptación se mostrará aquí una vez generada.
              </p>
            </div>
          )
        ) : (
          mermaidDiagram ? (
            <div className="flex flex-col items-center justify-center min-h-[460px] p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              {mermaidSvg ? (
                <div
                  ref={mermaidContainerRef}
                  className="w-full flex justify-center overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                />
              ) : mermaidError ? (
                <div className="w-full">
                  <div className="p-3 mb-4 rounded-xl bg-amber-950/40 border border-amber-600/30 text-amber-300 text-xs">
                    ⚠️ Vista gráfica no disponible: mostrando sintaxis Mermaid en texto plano.
                  </div>
                  <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap">
                    {mermaidDiagram}
                  </pre>
                </div>
              ) : (
                <div className="text-xs text-slate-400">Compilando diagrama de arquitectura...</div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-12 text-slate-500 my-auto h-full">
              <GitBranch className="w-12 h-12 mb-3 stroke-[1.5] text-slate-600" />
              <p className="text-sm font-medium text-slate-300">Diagrama de Arquitectura Pendiente</p>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                El flujo de componentes en sintaxis Mermaid se renderizará automáticamente tras la inferencia de Gemini.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
