-- Endurecimiento del onboarding publico.
--
-- 1. Mantiene el token util durante toda la ventana de ajuste posterior al
--    primer cierre.
-- 2. Serializa turnos del agente por sesion para evitar respuestas dobles.
-- 3. Aplica una pausa minima y un limite total por sesion antes de consumir IA.

alter table discovery_sessions
  add column agent_turn_started_at timestamptz,
  add column last_user_message_at timestamptz,
  add column message_count integer not null default 0
    check (message_count >= 0);

-- Las sesiones ya cerradas conservan acceso hasta el final de sus 20 dias,
-- aunque su expiracion inicial de 7 dias haya quedado atras.
update discovery_sessions
set token_expires_at = greatest(
  token_expires_at,
  submitted_at + interval '20 days'
)
where submitted_at is not null;

create or replace function claim_discovery_agent_turn(
  p_session_id uuid,
  p_access_token text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target discovery_sessions%rowtype;
begin
  select * into target
  from discovery_sessions
  where id = p_session_id and access_token = p_access_token
  for update;

  if not found then
    return 'unauthorized';
  end if;

  if target.token_expires_at < now() then
    return 'expired';
  end if;

  if target.status = 'approved' then
    return 'locked';
  end if;

  -- Un turno abandonado se libera solo despues de dos minutos.
  if target.agent_turn_started_at is not null
     and target.agent_turn_started_at > now() - interval '2 minutes' then
    return 'busy';
  end if;

  if target.last_user_message_at is not null
     and target.last_user_message_at > now() - interval '2 seconds' then
    return 'rate_limited';
  end if;

  if target.message_count >= 300 then
    return 'limit_reached';
  end if;

  update discovery_sessions
  set agent_turn_started_at = now(),
      last_user_message_at = now(),
      message_count = message_count + 1
  where id = p_session_id;

  return 'claimed';
end;
$$;

create or replace function release_discovery_agent_turn(p_session_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update discovery_sessions
  set agent_turn_started_at = null
  where id = p_session_id;
$$;

revoke all on function claim_discovery_agent_turn(uuid, text) from public, anon, authenticated;
revoke all on function release_discovery_agent_turn(uuid) from public, anon, authenticated;
grant execute on function claim_discovery_agent_turn(uuid, text) to service_role;
grant execute on function release_discovery_agent_turn(uuid) to service_role;

-- El bucket formaba parte del flujo real pero no estaba reproducido por las
-- migraciones. Se mantiene privado: solo el backend con service role accede.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'discovery-assets',
  'discovery-assets',
  false,
  15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
