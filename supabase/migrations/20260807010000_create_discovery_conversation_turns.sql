-- Historial de conversación del agente de IA — Business Discovery Agent.
-- Permite reconstruir el hilo completo si el usuario cierra la pestaña y
-- regresa después con el mismo link. Ver docs/business-discovery-agent/AI-AGENT-DESIGN.md.
--
-- `content` guarda el arreglo de bloques de contenido tal como los usa la API
-- de Mensajes de Anthropic (texto, tool_use, tool_result) para cada turno.
-- Los bloques de imagen NO se persisten con su base64 completo aquí — se
-- reemplazan por un marcador de texto antes de guardar (ver
-- src/features/business-discovery-agent/ai/conversation-store.ts) para no
-- inflar la tabla con megabytes repetidos; la imagen real solo se manda a
-- Claude en el turno en que se sube.
--
-- `tool_calls` es una columna separada y redundante a propósito (pedido
-- explícito al aprobar el diseño): el arreglo de bloques tool_use del turno,
-- si los hay, para poder auditar/depurar sin tener que parsear `content`.

create table discovery_conversation_turns (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references discovery_sessions(id) on delete cascade,
  role         text not null check (role in ('user', 'assistant')),
  content      jsonb not null,
  tool_calls   jsonb,
  created_at   timestamptz not null default now()
);

create index discovery_conversation_turns_session_id_idx
  on discovery_conversation_turns(session_id, created_at);

-- Mismo criterio que las demás tablas discovery_*: RLS activado sin policies
-- todavía porque el MVP solo lee/escribe vía server actions con la service
-- role key (bypassa RLS).
alter table discovery_conversation_turns enable row level security;
