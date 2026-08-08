-- Business Discovery Agent — tablas iniciales.
-- Ver docs/business-discovery-agent/DATA_MODEL.md para el diseño completo.
--
-- NOTA: el schema `public` de este proyecto estaba completamente vacío antes de
-- esta migración (confirmado por el dueño del proyecto en el dashboard de Supabase
-- y verificado de nuevo aquí con `supabase db query`). No existe todavía una tabla
-- `organizations` en este proyecto, así que `discovery_sessions.tenant_id` se deja
-- como uuid simple, sin foreign key, hasta que esa tabla exista.
--
-- access_token: se generan 2 UUIDv4 (gen_random_uuid() es built-in desde
-- Postgres 13, sin depender de la extensión pgcrypto) y se concatenan sus
-- hex digits, dando ~244 bits de aleatoriedad — cumple D2 (largo, no
-- secuencial, no adivinable) sin depender de una extensión externa.

create table discovery_sessions (
  id                  uuid primary key default gen_random_uuid(),
  access_token        text not null unique
                      default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  token_expires_at    timestamptz not null default (now() + interval '7 days'),
  pack_id             text not null,
  pack_version        text not null,
  business_name_draft text,
  tenant_id           uuid, -- sin FK todavía: la tabla organizations no existe en este proyecto
  owner_contact       jsonb,
  status              text not null default 'in_progress'
                      check (status in ('in_progress', 'submitted', 'approved')),
  current_section_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  submitted_at        timestamptz,
  approved_at         timestamptz
);

create table discovery_responses (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references discovery_sessions(id) on delete cascade,
  question_id  text not null,
  section_id   text not null,
  value        jsonb,
  status       text not null default 'draft'
               check (status in ('unanswered', 'draft', 'owner_confirmed', 'flagged_missing', 'unknown')),
  source       text not null default 'user_input'
               check (source in ('user_input', 'inferred', 'ai_extracted', 'default')),
  confidence   numeric,
  origin_ref   text,
  captured_at  timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (session_id, question_id)
);

create table discovery_assets (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references discovery_sessions(id) on delete cascade,
  question_id        text not null,
  storage_path       text not null,
  original_filename  text,
  mime_type          text,
  size_bytes         bigint,
  uploaded_at        timestamptz not null default now()
);

create table discovery_exports (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references discovery_sessions(id) on delete cascade,
  document_name  text not null,
  content        jsonb,
  generated_at   timestamptz not null default now()
);

create index discovery_responses_session_id_idx on discovery_responses(session_id);
create index discovery_assets_session_id_idx on discovery_assets(session_id);
create index discovery_exports_session_id_idx on discovery_exports(session_id);

-- Auto-actualizar updated_at.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger discovery_sessions_updated_at
before update on discovery_sessions
for each row execute function set_updated_at();

create trigger discovery_responses_updated_at
before update on discovery_responses
for each row execute function set_updated_at();

-- RLS activado, sin policies todavía: el MVP escribe/lee exclusivamente vía
-- server actions con la service role key (bypassa RLS), así que esto bloquea
-- por defecto cualquier acceso directo desde el cliente hasta que se diseñen
-- policies reales (ver OPEN_DECISIONS.md, D2).
alter table discovery_sessions  enable row level security;
alter table discovery_responses enable row level security;
alter table discovery_assets    enable row level security;
alter table discovery_exports   enable row level security;
