-- Vertical slice: de discovery aprobado a cliente ACTIIVA.
--
-- Las sesiones existentes permanecen con tenant_id = null. Una sesion solo
-- adquiere organizacion mediante convert_discovery_session_to_organization,
-- que bloquea la fila y crea ambos lados de la relacion en una transaccion.

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  slug        text not null unique
              check (char_length(slug) between 2 and 80)
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status      text not null default 'active'
              check (status in ('active', 'suspended', 'archived')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('owner', 'admin', 'member')),
  status          text not null default 'active'
                  check (status in ('active', 'disabled')),
  added_by        uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on organization_members(user_id, organization_id)
  where status = 'active';

create trigger organizations_updated_at
before update on organizations
for each row execute function set_updated_at();

alter table discovery_sessions
  add constraint discovery_sessions_tenant_id_fkey
  foreign key (tenant_id) references organizations(id) on delete restrict;

create index discovery_sessions_tenant_id_idx
  on discovery_sessions(tenant_id)
  where tenant_id is not null;

-- Una sesion nunca puede cambiar de cliente una vez vinculada. Evita cruces
-- accidentales incluso si una futura accion administrativa contiene un bug.
create or replace function prevent_discovery_tenant_reassignment()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.tenant_id is not null and new.tenant_id is distinct from old.tenant_id then
    raise exception 'discovery tenant cannot be reassigned';
  end if;
  return new;
end;
$$;

create trigger discovery_sessions_prevent_tenant_reassignment
before update of tenant_id on discovery_sessions
for each row execute function prevent_discovery_tenant_reassignment();

alter table organizations enable row level security;
alter table organization_members enable row level security;

-- Las cuentas autenticadas solo pueden descubrir sus propias membresias y
-- las organizaciones a las que pertenecen. Toda escritura sigue reservada al
-- backend de ACTIIVA con service_role.
create policy organization_members_read_own
on organization_members
for select
to authenticated
using (user_id = auth.uid());

create policy organizations_read_active_members
on organizations
for select
to authenticated
using (
  exists (
    select 1
    from organization_members membership
    where membership.organization_id = organizations.id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  )
);

revoke all on organizations from anon, authenticated;
revoke all on organization_members from anon, authenticated;
grant select on organizations to authenticated;
grant select on organization_members to authenticated;

create or replace function convert_discovery_session_to_organization(
  p_session_id uuid,
  p_name text,
  p_slug text,
  p_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target discovery_sessions%rowtype;
  organization_id uuid;
  normalized_name text := trim(p_name);
  base_slug text := lower(trim(p_slug));
  candidate_slug text;
begin
  select * into target
  from discovery_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'discovery session not found';
  end if;

  if target.tenant_id is not null then
    return target.tenant_id;
  end if;

  if target.status <> 'approved' then
    raise exception 'only approved discovery sessions can become organizations';
  end if;

  if normalized_name is null or char_length(normalized_name) not between 1 and 120 then
    raise exception 'organization name is invalid';
  end if;

  if base_slug is null
     or char_length(base_slug) not between 2 and 70
     or base_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'organization slug is invalid';
  end if;

  if not exists (select 1 from auth.users where id = p_created_by) then
    raise exception 'creating administrator not found';
  end if;

  candidate_slug := base_slug;
  while exists (select 1 from organizations where slug = candidate_slug) loop
    candidate_slug := base_slug || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end loop;

  insert into organizations (name, slug, created_by)
  values (normalized_name, candidate_slug, p_created_by)
  returning id into organization_id;

  update discovery_sessions
  set tenant_id = organization_id
  where id = p_session_id;

  return organization_id;
end;
$$;

revoke all on function convert_discovery_session_to_organization(uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function convert_discovery_session_to_organization(uuid, text, text, uuid)
to service_role;

comment on table organizations is
  'Tenant boundary for each ACTIIVA client. Created from an approved discovery session.';
comment on table organization_members is
  'Explicit user membership and role inside one ACTIIVA tenant.';
