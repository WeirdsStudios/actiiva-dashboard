import type { QuestionPack } from "../../engine/question-pack.types";
import * as infoGeneral from "./sections/info-general";
import * as brand from "./sections/brand";
import * as digitalPresence from "./sections/digital-presence";
import * as offerings from "./sections/offerings";
import * as pricing from "./sections/pricing";
import * as schedule from "./sections/schedule";
import * as team from "./sections/team";
import * as locationPayment from "./sections/location-payment";
import * as policies from "./sections/policies";
import * as audience from "./sections/audience";
import * as website from "./sections/website";

// Cada sección vive en su propio archivo bajo ./sections — un sub-entregable
// verificable por separado, según docs/business-discovery-agent/IMPLEMENTATION_PLAN.md.
// La Sección 12 ("Revisión de información faltante") no tiene contenido de preguntas
// aquí: es la pantalla de revisión final (/revision), Fase 4, no un question pack.
const sectionModules = [
  infoGeneral,
  brand,
  digitalPresence,
  offerings,
  pricing,
  schedule,
  team,
  locationPayment,
  policies,
  audience,
  website,
];

export const questionPackActiiva: QuestionPack = {
  id: "question-pack-actiiva",
  version: "0.2.0",
  industry: "fitness",
  sections: sectionModules.map((m) => m.section),
  questions: sectionModules.flatMap((m) => m.questions),
};
