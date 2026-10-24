import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevStory AI — Del boceto al código en 30 segundos",
  description:
    "Plataforma SaaS B2B que convierte notas de voz, requerimientos y bocetos en PRD, backlog para Jira y prototipos React + Tailwind CSS interactivos.",
  manifest: "/manifest.webmanifest",
  applicationName: "DevStory AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DevStory AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark overflow-x-hidden max-w-[100vw]">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white overflow-x-hidden max-w-[100vw]">
        {children}
      </body>
    </html>
  );
}
