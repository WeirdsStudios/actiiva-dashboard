import type { QuestionDefinition, QuestionSection } from "../../../engine/question-pack.types";

export const section: QuestionSection = {
  id: "sitio-web",
  order: 11,
  title: "Información necesaria para el sitio web",
};

export const questions: QuestionDefinition[] = [
  {
    id: "website.tagline",
    sectionId: "sitio-web",
    order: 1,
    prompt: "Si tuvieras que resumir tu negocio en una frase, ¿cuál sería?",
    helpText: "La usamos como frase principal de tu sitio.",
    type: "short_text",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    dataTarget: "website-content.tagline",
    sensitivity: "public",
  },
  {
    id: "website.hero_photos",
    sectionId: "sitio-web",
    order: 2,
    prompt: "Sube 1-5 fotos que representen mejor tu negocio",
    helpText: "El lugar, una clase, el equipo — lo que mejor te represente.",
    type: "file_upload",
    required: false,
    allowSkip: true,
    allowUnknown: false,
    fileConstraint: { accept: ["image/png", "image/jpeg", "image/webp"], maxSizeMb: 15, maxFiles: 5 },
    dataTarget: "asset-manifest.heroPhotos",
    sensitivity: "public",
  },
  {
    id: "website.testimonial",
    sectionId: "sitio-web",
    order: 3,
    prompt: "¿Tienes algún testimonio de cliente que quieras destacar?",
    type: "long_text",
    required: false,
    allowSkip: true,
    allowUnknown: true,
    dataTarget: "website-content.testimonial",
    sensitivity: "public",
  },
];
