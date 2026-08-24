-- Primer producto vertical por industria: plataforma de gimnasio.
-- Conserva organizations como frontera y separa operadores del negocio
-- (organization_members) de los socios finales del gimnasio (gym_customers).

create or replace function is_active_organization_manager(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from organization_members
    where organization_id = target_organization_id
      and user_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin')
  );
$$;

revoke all on function is_active_organization_manager(uuid) from public, anon;
grant execute on function is_active_organization_manager(uuid) to authenticated;

create table organization_sites (
  organization_id uuid primary key references organizations(id) on delete cascade,
  subdomain       text not null unique
                  check (char_length(subdomain) between 2 and 63)
                  check (subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  site_name       text not null check (char_length(site_name) between 1 and 100),
  industry        text not null check (industry in ('gym')),
  status          text not null default 'draft' check (status in ('draft', 'published', 'paused')),
  tagline         text not null default '',
  description     text not null default '',
  address         text not null default '',
  phone           text not null default '',
  primary_color   text not null default '#20252B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  accent_color    text not null default '#FF6B4A' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger organization_sites_updated_at
before update on organization_sites
for each row execute function set_updated_at();

create table gym_membership_plans (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (char_length(name) between 1 and 80),
  description     text not null default '',
  price_cents     integer not null check (price_cents >= 0),
  billing_period  text not null default 'month' check (billing_period in ('month', 'year', 'one_time')),
  features        jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  published       boolean not null default false,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create trigger gym_membership_plans_updated_at
before update on gym_membership_plans
for each row execute function set_updated_at();

create table gym_classes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  slug            text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name            text not null check (char_length(name) between 1 and 80),
  coach           text not null check (char_length(coach) between 1 and 80),
  weekdays        smallint[] not null check (weekdays <@ array[0,1,2,3,4,5,6]::smallint[]),
  start_time      time not null,
  duration_minutes smallint not null check (duration_minutes between 15 and 180),
  capacity        smallint not null check (capacity between 1 and 200),
  intensity       text not null check (intensity in ('base', 'medium', 'high')),
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, slug)
);

create trigger gym_classes_updated_at
before update on gym_classes
for each row execute function set_updated_at();

create table gym_customers (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  plan_id           uuid references gym_membership_plans(id) on delete set null,
  name              text not null check (char_length(name) between 1 and 120),
  email             text not null check (char_length(email) between 3 and 254),
  status            text not null default 'lead' check (status in ('lead', 'active', 'paused', 'cancelled')),
  joined_on         date,
  next_payment_on   date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, email),
  unique (organization_id, user_id)
);

create index gym_customers_organization_status_idx
on gym_customers(organization_id, status);

create trigger gym_customers_updated_at
before update on gym_customers
for each row execute function set_updated_at();

alter table organization_sites enable row level security;
alter table gym_membership_plans enable row level security;
alter table gym_classes enable row level security;
alter table gym_customers enable row level security;

create policy organization_sites_public_read
on organization_sites for select to anon, authenticated
using (status = 'published');

create policy organization_sites_manager_read
on organization_sites for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_plans_public_read
on gym_membership_plans for select to anon, authenticated
using (published = true);

create policy gym_plans_manager_read
on gym_membership_plans for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_classes_public_read
on gym_classes for select to anon, authenticated
using (published = true);

create policy gym_classes_manager_read
on gym_classes for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_customers_read_own
on gym_customers for select to authenticated
using (user_id = auth.uid());

create policy gym_customers_manager_read
on gym_customers for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_customers_manager_update
on gym_customers for update to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

revoke all on organization_sites, gym_membership_plans, gym_classes, gym_customers
from anon, authenticated;
grant select on organization_sites, gym_membership_plans, gym_classes to anon, authenticated;
grant select on gym_customers to authenticated;
grant update (status) on gym_customers to authenticated;

comment on table organization_sites is
  'Published tenant sites resolved from an ACTIIVA subdomain.';
comment on table gym_customers is
  'End customers of a gym; separate from ACTIIVA organization operators.';
