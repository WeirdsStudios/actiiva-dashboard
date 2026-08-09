// Referencia de cómo leer siempre la versión MÁS RECIENTE de los documentos
// de exportación de una sesión — la forma real en que el proceso de
// construcción debe consumir discovery_exports (se regenera completo en
// cada cierre de sesión, incluyendo recierres tras una corrección; las
// generaciones viejas no se borran, quedan como historial).
//
// Uso: bun run scripts/read-discovery-exports.ts <sessionId>
import { getLatestExports } from "../src/features/business-discovery-agent/export/build-export";

const sessionId = process.argv[2];
if (!sessionId) {
  console.error("uso: bun run scripts/read-discovery-exports.ts <sessionId>");
  process.exit(1);
}

const result = await getLatestExports(sessionId);
if (!result) {
  console.error("Esta sesión todavía no tiene ninguna exportación generada (no se ha cerrado nunca).");
  process.exit(1);
}

console.log(`Generación más reciente: ${result.generatedAt}\n`);
for (const doc of result.documents) {
  console.log(`=== ${doc.documentName} ===`);
  console.log(JSON.stringify(doc.content, null, 2));
  console.log();
}
