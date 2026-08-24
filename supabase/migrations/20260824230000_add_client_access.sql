-- Vertical slice: invitaciones, roles y activacion del portal de clientes.

alter table organization_members
  drop constraint organization_members_status_check;

alter table organization_members
  add constraint organization_members_status_check
  check (status in ('invited', 'active', 'disabled')),
  add column invited_at timestamptz,
  add column activated_at timestamptz,
  add column updated_at timestamptz not null default now();

update organization_members
set activated_at = created_at
where status = 'active';

create trigger organization_members_updated_at
before update on organization_members
for each row execute function set_updated_at();

-- Unico punto de escritura para Operaciones ACTIIVA. Bloquea la organizacion
-- para serializar cambios y evita desactivar o degradar al ultimo owner activo.
create or replace function set_organization_member_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_role text,
  p_status text,
  p_added_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member organization_members%rowtype;
  active_owner_count integer;
begin
  if p_role not in ('owner', 'admin', 'member') then
    raise exception 'invalid organization role';
  end if;
  if p_status not in ('invited', 'active', 'disabled') then
    raise exception 'invalid organization member status';
  end if;

  perform 1 from organizations where id = p_organization_id for update;
  if not found then
    raise exception 'organization not found';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'organization user not found';
  end if;
  if not exists (select 1 from auth.users where id = p_added_by) then
    raise exception 'adding administrator not found';
  end if;

  select * into current_member
  from organization_members
  where organization_id = p_organization_id and user_id = p_user_id;

  if found
     and current_member.role = 'owner'
     and current_member.status = 'active'
     and (p_role <> 'owner' or p_status <> 'active') then
    select count(*) into active_owner_count
    from organization_members
    where organization_id = p_organization_id
      and role = 'owner'
      and status = 'active';
    if active_owner_count <= 1 then
      raise exception 'organization must keep one active owner';
    end if;
  end if;

  insert into organization_members (
    organization_id,
    user_id,
    role,
    status,
    added_by,
    invited_at,
    activated_at
  ) values (
    p_organization_id,
    p_user_id,
    p_role,
    p_status,
    p_added_by,
    case when p_status = 'invited' then now() else null end,
    case when p_status = 'active' then now() else null end
  )
  on conflict (organization_id, user_id) do update
  set role = excluded.role,
      status = excluded.status,
      added_by = excluded.added_by,
      invited_at = case
        when excluded.status = 'invited' then coalesce(organization_members.invited_at, now())
        else organization_members.invited_at
      end,
      activated_at = case
        when excluded.status = 'active' then coalesce(organization_members.activated_at, now())
        else organization_members.activated_at
      end;
end;
$$;

revoke all on function set_organization_member_access(uuid, uuid, text, text, uuid)
from public, anon, authenticated;
grant execute on function set_organization_member_access(uuid, uuid, text, text, uuid)
to service_role;

-- La aceptacion de una invitacion solo puede activar membresias del propio
-- usuario autenticado; no recibe IDs desde el navegador.
create or replace function activate_own_organization_memberships()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  update organization_members
  set status = 'active',
      activated_at = coalesce(activated_at, now())
  where user_id = auth.uid()
    and status = 'invited';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function activate_own_organization_memberships()
from public, anon;
grant execute on function activate_own_organization_memberships()
to authenticated;

comment on function activate_own_organization_memberships() is
  'Activates only invited memberships belonging to the authenticated user.';
