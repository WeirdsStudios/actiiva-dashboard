import type Anthropic from "@anthropic-ai/sdk";

// La API de visión de Claude solo acepta estos 4 formatos rasterizados —
// notablemente NO incluye SVG, que brand.logo_file sí acepta como tipo de
// archivo. Ver AI-AGENT-DESIGN.md §6.2 (decisión aprobada: fallback
// conversacional para SVG, sin agregar una dependencia de rasterizado).
const VISION_SUPPORTED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function isVisionSupportedMimeType(mimeType: string): boolean {
  return VISION_SUPPORTED_MIME_TYPES.has(mimeType);
}

type VisionMediaType = "image/png" | "image/jpeg" | "image/gif" | "image/webp";

export async function fileToImageBlock(file: File): Promise<Anthropic.ImageBlockParam | null> {
  if (!isVisionSupportedMimeType(file.type)) return null;

  const buffer = Buffer.from(await file.arrayBuffer());

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: file.type as VisionMediaType,
      data: buffer.toString("base64"),
    },
  };
}
