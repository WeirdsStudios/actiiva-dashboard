const LONG_FINANCIAL_NUMBER = /(?:\d[\s-]?){13,19}/g;
const REDACTION_MARKER = "[dato financiero omitido por seguridad]";

export function redactSensitiveFinancialNumbers(text: string): string {
  return text.replace(LONG_FINANCIAL_NUMBER, (candidate) => {
    const digits = candidate.replace(/\D/g, "");
    return digits.length >= 13 && digits.length <= 19 ? REDACTION_MARKER : candidate;
  });
}

export function containsSensitiveFinancialNumber(text: string): boolean {
  return redactSensitiveFinancialNumbers(text) !== text;
}

export async function validateImageSignature(file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  const bytes = new Uint8Array(await file.slice(0, 2_048).arrayBuffer());
  const matchesPng = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte);
  const matchesJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const matchesWebp = bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  const matchesGif = bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(new TextDecoder().decode(bytes.slice(0, 6)));
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "").trimStart();
  const matchesSvg = /^(?:<\?xml[^>]*>\s*)?<svg[\s>]/i.test(text);

  const signatureMatches =
    (file.type === "image/png" && matchesPng) ||
    (file.type === "image/jpeg" && matchesJpeg) ||
    (file.type === "image/webp" && matchesWebp) ||
    (file.type === "image/gif" && matchesGif) ||
    (file.type === "image/svg+xml" && matchesSvg);

  if (!signatureMatches) return { ok: false, error: "El contenido del archivo no coincide con su tipo." };
  if (file.type === "image/svg+xml") {
    const fullSvg = await file.text();
    if (/<script|<foreignObject|\son\w+\s*=/i.test(fullSvg)) {
      return { ok: false, error: "El SVG contiene elementos no permitidos." };
    }
  }
  return { ok: true };
}
