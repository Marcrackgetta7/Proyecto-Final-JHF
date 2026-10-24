import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DevStory AI — Del Boceto al Código",
    short_name: "DevStory AI",
    description:
      "Plataforma SaaS B2B AI-Native que convierte notas de voz, texto y bocetos en PRD, backlog de Jira y prototipos React + Tailwind.",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#4f46e5",
    icons: [
      {
        src: "/icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
