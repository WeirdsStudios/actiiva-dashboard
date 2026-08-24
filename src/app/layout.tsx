import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://onboarding.actiiva.mx"),
  title: "ACTIIVA — Configura tu negocio",
  description:
    "Platica por chat para configurar tu cuenta y tu sitio web con ACTIIVA. Toma entre 15 y 20 minutos, y puedes pausar cuando quieras.",
  openGraph: {
    title: "ACTIIVA — Configura tu negocio",
    description: "Platica por chat para configurar tu cuenta y tu sitio web. Toma entre 15 y 20 minutos.",
    siteName: "ACTIIVA",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ACTIIVA — Configura tu negocio",
    description: "Platica por chat para configurar tu cuenta y tu sitio web. Toma entre 15 y 20 minutos.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
