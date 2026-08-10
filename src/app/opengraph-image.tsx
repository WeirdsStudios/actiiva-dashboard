import { ImageResponse } from "next/og";

export const contentType = "image/png";
export const size = { width: 1200, height: 630 };

// Imagen OG generada dinámicamente (next/og, sin dependencias nuevas — mismo
// patrón que user-core/app/opengraph-image.tsx). Next.js la sirve en
// /opengraph-image y la referencia sola en los meta tags de layout.tsx.
//
// El símbolo y el wordmark NO se typografían aquí — son la geometría exacta
// (mismos puntos/circle) de assets/svg/actiiva-symbol-inverse.svg y
// actiiva-wordmark-inverse.svg del brand system real, solo insertada inline
// porque ImageResponse (Satori) no puede cargar un <img src="/brand/*.svg">
// de forma confiable — regla README_AI_IMPLEMENTATION.md #1: nunca
// redibujar/typesetear el wordmark.
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#222931", // Deep Space
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <svg width="72" height="92.5" viewBox="0 0 50.72 65.18" fill="none">
            <polygon fill="#F2F3F5" points="1.96 13.47 1.97 65.18 9.25 55.98 9.21 22.11 1.96 13.47" />
            <circle fill="#F2F3F5" cx="5.01" cy="5.01" r="5.01" />
            <polygon fill="#F2F3F5" points="49.56 13.47 49.56 65.18 42.28 55.98 42.31 22.11 49.56 13.47" />
            <circle fill="#F2F3F5" cx="45.71" cy="5.01" r="5.01" />
            <polygon fill="#414D5A" points="46.62 65.18 5.12 65.17 11.76 57.9 40.53 57.93 46.62 65.18" />
          </svg>
          <svg width="230" height="28" viewBox="0 0 324.03 39.47" fill="none">
            <path
              fill="#F2F3F5"
              d="M22.06,1.05L0,38.9h2.3l5.52-9.57h27.96l5.58,9.57h4.95L24.25,1.05h-2.2ZM34.22,26.54H9.44L21.83,5.21l12.39,21.33Z"
            />
            <path
              fill="#F2F3F5"
              d="M102.41,32.47l-.23-.41-.94.96c-2.57,2.64-7.95,4.34-13.72,4.34-11.74,0-19.94-7.7-19.94-17.41S75.72,2.59,87.39,2.59c5.82,0,11.21,1.66,13.73,4.24l.86.88.29-.29c.03-.14.21-.7.34-1.11.09-.28.17-.55.22-.71l.13-.43-.35-.29c-3.17-2.64-9.17-4.28-15.67-4.28-14.08,0-23.91,7.96-23.91,19.35s9.86,19.4,23.97,19.4c6.52,0,12.55-1.68,15.74-4.39l.36-.3-.15-.44c-.43-1.24-.52-1.63-.54-1.74Z"
            />
            <polygon
              fill="#F2F3F5"
              points="119.28 2.94 137.36 2.94 137.36 38.9 141.84 38.9 141.84 2.94 159.92 2.94 159.92 1.05 119.28 1.05 119.28 2.94"
            />
            <polygon fill="#F2F3F5" points="272.83 1.05 253.62 34.67 234.53 1.05 229.53 1.05 251.19 38.9 253.91 38.9 275.57 1.05 272.83 1.05" />
            <path
              fill="#F2F3F5"
              d="M301.98,1.05h-2.66l-22.06,37.85h2.76l5.52-9.57h27.96l5.58,9.57h4.95L301.98,1.05ZM311.95,26.54h-24.78l12.39-21.33,12.39,21.33Z"
            />
            <polygon fill="#F2F3F5" points="181.97 8.9 181.97 39.47 185.73 34.04 185.71 14.01 181.97 8.9" />
            <circle fill="#F2F3F5" cx="183.77" cy="2.96" r="2.96" />
            <polygon fill="#F2F3F5" points="210.11 8.9 210.1 39.47 206.35 34.04 206.37 14.01 210.11 8.9" />
            <circle fill="#F2F3F5" cx="207.83" cy="2.96" r="2.96" />
          </svg>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              color: "#F2F3F5",
              fontSize: "44px",
              fontWeight: 600,
              lineHeight: 1.2,
              maxWidth: "920px",
              display: "flex",
            }}
          >
            Vamos a configurar tu cuenta y tu sitio web
          </div>
          {/* Lumen Haze como señal puntual (regla del brand system: 1-3% de
              pantalla) — una sola línea delgada, nunca como superficie. */}
          <div style={{ width: "88px", height: "6px", background: "#E9EF14", display: "flex" }} />
          <div style={{ color: "#9AA5B0", fontSize: "24px", display: "flex" }}>
            Presencia online · Gestión de negocio · Portal de clientes
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
