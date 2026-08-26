-- Vertical slice: an approved onboarding becomes a repeatable, auditable
-- fitness platform. Provisioning is atomic and idempotent; publishing is a
-- separate gated decision so incomplete drafts never become public.

alter table organization_sites
  add column source_session_id uuid references discovery_sessions(id) on delete restrict,
  add column provisioned_by uuid references auth.users(id) on delete set null,
  add column provisioned_at timestamptz,
  add column published_at timestamptz;

create unique index organization_sites_source_session_idx
on organization_sites(source_session_id)
where source_session_id is not null;

update organization_sites
set provisioned_at = created_at,
    published_at = case when status = 'published' then created_at else null end
where provisioned_at is null;

create table organization_platform_events (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  source_session_id uuid references discovery_sessions(id) on delete set null,
  event_type        text not null check (event_type in ('provisioned', 'published', 'paused')),
  actor_id          uuid references auth.users(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at        timestamptz not null default now()
);

create index organization_platform_events_org_created_idx
on organization_platform_events(organization_id, created_at desc);

alter table organization_platform_events enable row level security;
revoke all on organization_platform_events from public, anon, authenticated;

create or replace function provision_organization_gym_platform(
  p_organization_id uuid,
  p_source_session_id uuid,
  p_subdomain text,
  p_site_name text,
  p_tagline text,
  p_description text,
  p_address text,
  p_phone text,
  p_primary_color text,
  p_accent_color text,
  p_plans jsonb,
  p_classes jsonb,
  p_drop_in_price_cents integer,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization organizations%rowtype;
  target_session discovery_sessions%rowtype;
  existing_site organization_sites%rowtype;
  plan_item jsonb;
  class_item jsonb;
  class_weekdays smallint[];
begin
  select * into target_organization
  from organizations
  where id = p_organization_id
  for update;
  if not found or target_organization.status <> 'active' then
    raise exception 'active organization not found';
  end if;

  select * into target_session
  from discovery_sessions
  where id = p_source_session_id
    and tenant_id = p_organization_id
    and status = 'approved';
  if not found then raise exception 'approved linked discovery required'; end if;

  if not exists (select 1 from auth.users where id = p_actor_id) then
    raise exception 'provisioning administrator not found';
  end if;
  if p_subdomain is null
     or char_length(p_subdomain) not between 2 and 63
     or p_subdomain !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     or p_subdomain in ('www', 'onboarding', 'app', 'admin', 'api', 'status') then
    raise exception 'invalid or reserved subdomain';
  end if;
  if trim(p_site_name) = '' or char_length(trim(p_site_name)) > 100 then
    raise exception 'invalid site name';
  end if;
  if p_primary_color !~ '^#[0-9A-Fa-f]{6}$' or p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then
    raise exception 'invalid brand colors';
  end if;
  if jsonb_typeof(p_plans) <> 'array' or jsonb_typeof(p_classes) <> 'array' then
    raise exception 'invalid platform offering';
  end if;

  select * into existing_site
  from organization_sites
  where organization_id = p_organization_id;
  if found then
    if existing_site.source_session_id is distinct from p_source_session_id
       and existing_site.source_session_id is not null then
      raise exception 'organization platform already has another source';
    end if;
    return jsonb_build_object(
      'created', false,
      'subdomain', existing_site.subdomain,
      'status', existing_site.status
    );
  end if;

  insert into organization_sites (
    organization_id, subdomain, site_name, industry, status, tagline,
    description, address, phone, primary_color, accent_color,
    schedule_interest_threshold, demand_hold_hours, timezone, currency,
    source_session_id, provisioned_by, provisioned_at
  ) values (
    p_organization_id, p_subdomain, trim(p_site_name), 'gym', 'draft',
    left(coalesce(p_tagline, ''), 180), left(coalesce(p_description, ''), 600),
    left(coalesce(p_address, ''), 300), left(coalesce(p_phone, ''), 40),
    upper(p_primary_color), upper(p_accent_color), 4, 24,
    'America/Mexico_City', 'MXN', p_source_session_id, p_actor_id, now()
  );

  insert into gym_branches (
    organization_id, slug, name, address, phone, timezone, is_primary, status
  ) values (
    p_organization_id, 'principal', left(trim(p_site_name) || ' — Principal', 100),
    left(coalesce(p_address, ''), 300), left(coalesce(p_phone, ''), 40),
    'America/Mexico_City', true, 'active'
  );

  for plan_item in select value from jsonb_array_elements(p_plans)
  loop
    insert into gym_membership_plans (
      organization_id, slug, name, description, price_cents, billing_period,
      duration_count, duration_unit, class_access, class_credits, grace_days,
      auto_renew_available, features, published, sort_order
    ) values (
      p_organization_id,
      plan_item->>'slug',
      left(plan_item->>'name', 80),
      left(coalesce(plan_item->>'description', ''), 500),
      (plan_item->>'priceCents')::integer,
      plan_item->>'billingPeriod',
      (plan_item->>'durationCount')::smallint,
      plan_item->>'durationUnit',
      plan_item->>'classAccess',
      nullif(plan_item->>'classCredits', '')::smallint,
      0,
      false,
      '[]'::jsonb,
      coalesce((plan_item->>'published')::boolean, false),
      (select count(*)::smallint + 1 from gym_membership_plans where organization_id = p_organization_id)
    )
    on conflict (organization_id, slug) do nothing;
  end loop;

  insert into gym_catalog_items (
    organization_id, membership_plan_id, slug, sku, item_type, name,
    description, price_cents, published, active
  )
  select
    plan.organization_id, plan.id, 'membresia-' || plan.slug,
    'MEM-' || upper(left(plan.slug, 40)), 'membership', plan.name,
    plan.description, plan.price_cents, plan.published, true
  from gym_membership_plans plan
  where plan.organization_id = p_organization_id
  on conflict (organization_id, slug) do nothing;

  if p_drop_in_price_cents is not null and p_drop_in_price_cents >= 0 then
    insert into gym_catalog_items (
      organization_id, slug, sku, item_type, name, description,
      price_cents, published, active
    ) values (
      p_organization_id, 'clase-visita', 'SER-DROP', 'drop_in',
      'Clase de visita', 'Una sesión para conocer el espacio.',
      p_drop_in_price_cents, true, true
    )
    on conflict (organization_id, slug) do nothing;
  end if;

  for class_item in select value from jsonb_array_elements(p_classes)
  loop
    select array_agg(value::smallint order by value::smallint)
    into class_weekdays
    from jsonb_array_elements_text(class_item->'weekdays');

    insert into gym_classes (
      organization_id, slug, name, coach, weekdays, start_time,
      duration_minutes, capacity, intensity, published
    ) values (
      p_organization_id,
      class_item->>'slug',
      left(class_item->>'name', 80),
      left(class_item->>'coach', 80),
      class_weekdays,
      (class_item->>'startTime')::time,
      (class_item->>'durationMinutes')::smallint,
      (class_item->>'capacity')::smallint,
      class_item->>'intensity',
      coalesce((class_item->>'published')::boolean, false)
    )
    on conflict (organization_id, slug) do nothing;
  end loop;

  insert into gym_provider_connections (organization_id, provider, status, display_name)
  values
    (p_organization_id, 'mercado_pago', 'disconnected', 'Mercado Pago del negocio'),
    (p_organization_id, 'whatsapp', 'disconnected', 'WhatsApp del negocio')
  on conflict (organization_id, provider) do nothing;

  insert into organization_platform_events (
    organization_id, source_session_id, event_type, actor_id, metadata
  ) values (
    p_organization_id, p_source_session_id, 'provisioned', p_actor_id,
    jsonb_build_object(
      'subdomain', p_subdomain,
      'planCount', jsonb_array_length(p_plans),
      'classCount', jsonb_array_length(p_classes)
    )
  );

  return jsonb_build_object('created', true, 'subdomain', p_subdomain, 'status', 'draft');
end;
$$;

create or replace function publish_organization_gym_platform(
  p_organization_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_site organization_sites%rowtype;
  owner_count integer;
  branch_count integer;
  offering_count integer;
  class_count integer;
begin
  perform 1 from organizations where id = p_organization_id and status = 'active' for update;
  if not found then raise exception 'active organization not found'; end if;
  if not exists (select 1 from auth.users where id = p_actor_id) then
    raise exception 'publishing administrator not found';
  end if;

  select * into target_site from organization_sites
  where organization_id = p_organization_id for update;
  if not found then raise exception 'platform draft not found'; end if;
  if target_site.status = 'published' then
    return jsonb_build_object('subdomain', target_site.subdomain, 'status', target_site.status);
  end if;
  if target_site.source_session_id is null then raise exception 'onboarding source required'; end if;

  select count(*)::integer into owner_count
  from organization_members
  where organization_id = p_organization_id and role = 'owner' and status = 'active';
  select count(*)::integer into branch_count
  from gym_branches
  where organization_id = p_organization_id and status = 'active';
  select count(*)::integer into offering_count
  from gym_catalog_items
  where organization_id = p_organization_id and active = true and published = true;
  select count(*)::integer into class_count
  from gym_classes
  where organization_id = p_organization_id and published = true;

  if owner_count < 1 then raise exception 'active owner required'; end if;
  if branch_count < 1 then raise exception 'active branch required'; end if;
  if offering_count < 1 then raise exception 'published offering required'; end if;
  if class_count < 1 then raise exception 'published class required'; end if;

  update organization_sites
  set status = 'published', published_at = coalesce(published_at, now())
  where organization_id = p_organization_id
  returning * into target_site;

  insert into organization_platform_events (
    organization_id, source_session_id, event_type, actor_id, metadata
  ) values (
    p_organization_id, target_site.source_session_id, 'published', p_actor_id,
    jsonb_build_object('subdomain', target_site.subdomain)
  );

  return jsonb_build_object('subdomain', target_site.subdomain, 'status', target_site.status);
end;
$$;

revoke all on function provision_organization_gym_platform(
  uuid, uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, uuid
) from public, anon, authenticated;
grant execute on function provision_organization_gym_platform(
  uuid, uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, uuid
) to service_role;

revoke all on function publish_organization_gym_platform(uuid, uuid)
from public, anon, authenticated;
grant execute on function publish_organization_gym_platform(uuid, uuid)
to service_role;

comment on function provision_organization_gym_platform(
  uuid, uuid, text, text, text, text, text, text, text, text, jsonb, jsonb, integer, uuid
) is 'Atomically provisions one draft fitness platform from an approved linked discovery session.';
comment on function publish_organization_gym_platform(uuid, uuid)
is 'Publishes a provisioned platform only after ownership, branch, offering and schedule gates pass.';
