import { ImageResponse } from "next/og";
import { getPublicGymPlatform } from "@/features/gym-platform/server/data";

export const alt = "Plataforma digital de un negocio fitness creado con ACTIIVA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function GymOpenGraphImage({ params }: { params: Promise<{ siteSubdomain: string }> }) {
  const { siteSubdomain } = await params;
  const platform = await getPublicGymPlatform(siteSubdomain);
  const name = platform?.site.name ?? "ACTGym";
  const description = platform?.site.description ?? "Todo tu negocio fitness en un solo lugar.";
  const accent = platform?.site.accentColor ?? "#FF6B4A";
  const ink = platform?.site.primaryColor ?? "#20252B";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: ink, color: "#F8F6EE", padding: "72px 78px" }}>
      <div style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "39%", display: "flex", borderLeft: "1px solid rgba(255,255,255,.16)", background: "rgba(255,255,255,.025)" }} />
      <div style={{ position: "absolute", top: 0, right: "13%", bottom: 0, width: "1px", display: "flex", background: "rgba(255,255,255,.10)" }} />
      <div style={{ position: "absolute", right: 0, bottom: 80, width: "39%", height: 7, display: "flex", background: accent }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "66%", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, letterSpacing: 3 }}><span>ACT</span><span style={{ color: accent, margin: "0 12px" }}>/</span><span>GYM</span></div>
        <div style={{ display: "flex", flexDirection: "column" }}><span style={{ color: accent, fontSize: 20, fontWeight: 700, letterSpacing: 5, textTransform: "uppercase" }}>Fuerza · condición · movilidad</span><strong style={{ marginTop: 20, fontSize: 104, lineHeight: .84, letterSpacing: -4, textTransform: "uppercase" }}>{name}</strong><span style={{ maxWidth: 690, marginTop: 30, color: "rgba(255,255,255,.65)", fontSize: 26, lineHeight: 1.35 }}>{description}</span></div>
      </div>
      <div style={{ position: "absolute", right: 72, bottom: 40, display: "flex", color: "rgba(255,255,255,.45)", fontSize: 16, letterSpacing: 2 }}>CREADO CON ACTIIVA</div>
    </div>,
    size,
  );
}
