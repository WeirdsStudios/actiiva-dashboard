-- ACTIIVA commerce foundation. Separates people, membership periods and money
-- without deleting the legacy plan fields used by the first ACTGym slice.

alter table organization_sites
  alter column schedule_interest_threshold set default 4,
  add column currency text not null default 'MXN'
    check (currency ~ '^[A-Z]{3}$'),
  add column timezone text not null default 'America/Mexico_City',
  add column demand_hold_hours smallint not null default 24
    check (demand_hold_hours between 1 and 168);

create table gym_branches (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name              text not null check (char_length(name) between 1 and 100),
  address           text not null default '',
  phone             text not null default '',
  timezone          text not null default 'America/Mexico_City',
  is_primary        boolean not null default false,
  status            text not null default 'active' check (status in ('active', 'paused')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, slug),
  unique (id, organization_id)
);

create unique index gym_branches_one_primary_idx
on gym_branches(organization_id) where is_primary;

create trigger gym_branches_updated_at
before update on gym_branches
for each row execute function set_updated_at();

insert into gym_branches (organization_id, slug, name, address, phone, timezone, is_primary)
select organization_id, 'principal', site_name || ' — Principal', address, phone, timezone, true
from organization_sites
on conflict (organization_id, slug) do nothing;

alter table gym_membership_plans
  add column duration_count smallint not null default 1
    check (duration_count between 1 and 365),
  add column duration_unit text not null default 'month'
    check (duration_unit in ('day', 'week', 'month', 'year')),
  add column class_access text not null default 'unlimited'
    check (class_access in ('none', 'unlimited', 'credits')),
  add column class_credits smallint
    check (class_credits is null or class_credits between 1 and 1000),
  add column grace_days smallint not null default 0
    check (grace_days between 0 and 90),
  add column enrollment_fee_cents integer not null default 0
    check (enrollment_fee_cents >= 0),
  add column auto_renew_available boolean not null default false;

update gym_membership_plans
set duration_unit = case billing_period
  when 'year' then 'year'
  else 'month'
end
where billing_period in ('month', 'year');

create table gym_customer_memberships (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  customer_id           uuid not null,
  plan_id               uuid not null references gym_membership_plans(id) on delete restrict,
  status                text not null default 'pending'
                        check (status in ('pending', 'active', 'paused', 'expired', 'cancelled')),
  starts_on             date not null,
  ends_on               date not null check (ends_on >= starts_on),
  grace_ends_on         date not null,
  price_cents           integer not null check (price_cents >= 0),
  class_credits_total   integer check (class_credits_total is null or class_credits_total >= 0),
  class_credits_used    integer not null default 0 check (class_credits_used >= 0),
  auto_renew            boolean not null default false,
  source                text not null default 'migration'
                        check (source in ('migration', 'pos', 'portal', 'website', 'manual')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete cascade,
  unique (id, organization_id)
);

create index gym_customer_memberships_customer_idx
on gym_customer_memberships(customer_id, starts_on desc);

create unique index gym_customer_memberships_one_current_idx
on gym_customer_memberships(customer_id)
where status in ('active', 'paused');

create trigger gym_customer_memberships_updated_at
before update on gym_customer_memberships
for each row execute function set_updated_at();

insert into gym_customer_memberships (
  organization_id, customer_id, plan_id, status, starts_on, ends_on,
  grace_ends_on, price_cents, class_credits_total, source
)
select
  customer.organization_id,
  customer.id,
  customer.plan_id,
  case customer.status
    when 'active' then 'active'
    when 'paused' then 'paused'
    when 'cancelled' then 'cancelled'
    else 'pending'
  end,
  coalesce(customer.joined_on, current_date),
  coalesce(customer.next_payment_on - 1, (current_date + interval '1 month' - interval '1 day')::date),
  (coalesce(customer.next_payment_on - 1, (current_date + interval '1 month' - interval '1 day')::date)
    + plan.grace_days)::date,
  plan.price_cents,
  case when plan.class_access = 'credits' then plan.class_credits else null end,
  'migration'
from gym_customers customer
join gym_membership_plans plan on plan.id = customer.plan_id
where customer.status in ('active', 'paused')
on conflict do nothing;

create table gym_catalog_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  membership_plan_id uuid references gym_membership_plans(id) on delete set null,
  slug              text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  sku               text,
  item_type         text not null check (item_type in ('membership', 'service', 'product', 'class_pack', 'drop_in')),
  name              text not null check (char_length(name) between 1 and 120),
  description       text not null default '',
  price_cents       integer not null check (price_cents >= 0),
  cost_cents        integer not null default 0 check (cost_cents >= 0),
  tracks_inventory  boolean not null default false,
  published         boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organization_id, slug),
  unique (organization_id, sku),
  unique (id, organization_id),
  check ((item_type = 'membership') = (membership_plan_id is not null)),
  check (not tracks_inventory or item_type = 'product')
);

create trigger gym_catalog_items_updated_at
before update on gym_catalog_items
for each row execute function set_updated_at();

insert into gym_catalog_items (
  organization_id, membership_plan_id, slug, sku, item_type, name,
  description, price_cents, published, active
)
select organization_id, id, 'membresia-' || slug, 'MEM-' || upper(slug),
  'membership', name, description, price_cents, published, true
from gym_membership_plans
on conflict (organization_id, slug) do update
set membership_plan_id = excluded.membership_plan_id,
    name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    published = excluded.published;

create table gym_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null,
  customer_id       uuid,
  order_number      bigint generated always as identity,
  status            text not null default 'draft'
                    check (status in ('draft', 'pending', 'paid', 'cancelled', 'refunded')),
  source            text not null default 'pos'
                    check (source in ('pos', 'portal', 'website', 'system')),
  subtotal_cents    integer not null check (subtotal_cents >= 0),
  discount_cents    integer not null default 0 check (discount_cents >= 0),
  total_cents       integer not null check (total_cents >= 0),
  notes             text not null default '',
  created_by        uuid references auth.users(id) on delete set null,
  paid_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references gym_branches(id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete restrict,
  unique (id, organization_id),
  check (discount_cents <= subtotal_cents),
  check (total_cents = subtotal_cents - discount_cents)
);

create index gym_orders_organization_created_idx
on gym_orders(organization_id, created_at desc);

create trigger gym_orders_updated_at
before update on gym_orders
for each row execute function set_updated_at();

create table gym_order_items (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid not null,
  catalog_item_id   uuid,
  item_type         text not null check (item_type in ('membership', 'service', 'product', 'class_pack', 'drop_in')),
  description       text not null check (char_length(description) between 1 and 180),
  quantity          integer not null check (quantity between 1 and 1000),
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  total_cents       integer not null check (total_cents >= 0),
  metadata          jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at        timestamptz not null default now(),
  foreign key (order_id, organization_id)
    references gym_orders(id, organization_id) on delete cascade,
  foreign key (catalog_item_id, organization_id)
    references gym_catalog_items(id, organization_id) on delete restrict,
  check (total_cents = quantity * unit_price_cents)
);

create table gym_payments (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  order_id               uuid not null,
  customer_id            uuid,
  payment_method         text not null
                         check (payment_method in ('cash', 'card', 'bank_transfer', 'mercado_pago')),
  status                 text not null default 'pending'
                         check (status in ('pending', 'approved', 'rejected', 'refunded')),
  amount_cents           integer not null check (amount_cents > 0),
  provider               text,
  provider_payment_id    text,
  reference              text,
  received_by            uuid references auth.users(id) on delete set null,
  paid_at                timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  foreign key (order_id, organization_id)
    references gym_orders(id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete restrict,
  unique (organization_id, provider, provider_payment_id),
  unique (id, organization_id)
);

create index gym_payments_organization_paid_idx
on gym_payments(organization_id, paid_at desc);

create trigger gym_payments_updated_at
before update on gym_payments
for each row execute function set_updated_at();

create table gym_receipts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  order_id          uuid not null,
  customer_id       uuid,
  folio             bigint generated always as identity,
  public_token      uuid not null default gen_random_uuid() unique,
  issued_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  foreign key (order_id, organization_id)
    references gym_orders(id, organization_id) on delete restrict,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete restrict,
  unique (order_id)
);

create table gym_cash_sessions (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null,
  opened_by             uuid not null references auth.users(id) on delete restrict,
  closed_by             uuid references auth.users(id) on delete restrict,
  status                text not null default 'open' check (status in ('open', 'closed')),
  opening_amount_cents  integer not null default 0 check (opening_amount_cents >= 0),
  expected_amount_cents integer,
  closing_amount_cents  integer,
  opened_at             timestamptz not null default now(),
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references gym_branches(id, organization_id) on delete restrict,
  unique (id, organization_id)
);

create unique index gym_cash_sessions_one_open_idx
on gym_cash_sessions(branch_id) where status = 'open';

create trigger gym_cash_sessions_updated_at
before update on gym_cash_sessions
for each row execute function set_updated_at();

create table gym_inventory_levels (
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null,
  catalog_item_id   uuid not null,
  quantity          integer not null default 0,
  reorder_point     integer not null default 0 check (reorder_point >= 0),
  updated_at        timestamptz not null default now(),
  primary key (branch_id, catalog_item_id),
  foreign key (branch_id, organization_id)
    references gym_branches(id, organization_id) on delete cascade,
  foreign key (catalog_item_id, organization_id)
    references gym_catalog_items(id, organization_id) on delete cascade
);

create table gym_inventory_movements (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references organizations(id) on delete cascade,
  branch_id         uuid not null,
  catalog_item_id   uuid not null,
  order_item_id     uuid references gym_order_items(id) on delete set null,
  quantity_delta    integer not null check (quantity_delta <> 0),
  reason            text not null check (reason in ('sale', 'return', 'restock', 'adjustment')),
  note              text not null default '',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references gym_branches(id, organization_id) on delete restrict,
  foreign key (catalog_item_id, organization_id)
    references gym_catalog_items(id, organization_id) on delete restrict
);

create table gym_provider_connections (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  provider              text not null check (provider in ('mercado_pago', 'whatsapp')),
  status                text not null default 'disconnected'
                        check (status in ('disconnected', 'pending', 'connected', 'error')),
  external_account_id   text,
  display_name          text,
  metadata              jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  connected_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organization_id, provider)
);

create trigger gym_provider_connections_updated_at
before update on gym_provider_connections
for each row execute function set_updated_at();

alter table gym_branches enable row level security;
alter table gym_customer_memberships enable row level security;
alter table gym_catalog_items enable row level security;
alter table gym_orders enable row level security;
alter table gym_order_items enable row level security;
alter table gym_payments enable row level security;
alter table gym_receipts enable row level security;
alter table gym_cash_sessions enable row level security;
alter table gym_inventory_levels enable row level security;
alter table gym_inventory_movements enable row level security;
alter table gym_provider_connections enable row level security;

create policy gym_branches_public_read on gym_branches for select to anon, authenticated
using (status = 'active' and exists (
  select 1 from organization_sites site
  where site.organization_id = gym_branches.organization_id and site.status = 'published'
));
create policy gym_branches_manager_all on gym_branches for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_memberships_read_own on gym_customer_memberships for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.id = gym_customer_memberships.customer_id and customer.user_id = auth.uid()
));
create policy gym_memberships_manager_all on gym_customer_memberships for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_catalog_public_read on gym_catalog_items for select to anon, authenticated
using (published and active and exists (
  select 1 from organization_sites site
  where site.organization_id = gym_catalog_items.organization_id and site.status = 'published'
));
create policy gym_catalog_manager_all on gym_catalog_items for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_orders_read_own on gym_orders for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.id = gym_orders.customer_id and customer.user_id = auth.uid()
));
create policy gym_orders_manager_all on gym_orders for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_order_items_read_own on gym_order_items for select to authenticated
using (exists (
  select 1 from gym_orders gym_order
  join gym_customers customer on customer.id = gym_order.customer_id
  where gym_order.id = gym_order_items.order_id and customer.user_id = auth.uid()
));
create policy gym_order_items_manager_all on gym_order_items for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_payments_read_own on gym_payments for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.id = gym_payments.customer_id and customer.user_id = auth.uid()
));
create policy gym_payments_manager_all on gym_payments for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_receipts_read_own on gym_receipts for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.id = gym_receipts.customer_id and customer.user_id = auth.uid()
));
create policy gym_receipts_manager_read on gym_receipts for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_cash_sessions_manager_all on gym_cash_sessions for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));
create policy gym_inventory_levels_manager_all on gym_inventory_levels for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));
create policy gym_inventory_movements_manager_all on gym_inventory_movements for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));
create policy gym_provider_connections_manager_all on gym_provider_connections for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_plans_manager_write on gym_membership_plans for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy organization_sites_manager_update on organization_sites for update to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

revoke all on gym_branches, gym_customer_memberships, gym_catalog_items, gym_orders,
  gym_order_items, gym_payments, gym_receipts, gym_cash_sessions,
  gym_inventory_levels, gym_inventory_movements, gym_provider_connections
from anon, authenticated;

grant select on gym_branches, gym_catalog_items to anon, authenticated;
grant select on gym_customer_memberships, gym_orders, gym_order_items, gym_payments, gym_receipts to authenticated;
grant select, insert, update, delete on gym_branches, gym_customer_memberships,
  gym_catalog_items, gym_orders, gym_order_items, gym_payments, gym_cash_sessions,
  gym_inventory_levels, gym_inventory_movements, gym_provider_connections to authenticated;
grant select on gym_cash_sessions, gym_inventory_levels, gym_inventory_movements,
  gym_provider_connections to authenticated;
grant insert, update, delete on gym_membership_plans to authenticated;
grant update (schedule_interest_threshold, demand_hold_hours, timezone, currency)
on organization_sites to authenticated;

comment on table gym_customer_memberships is
  'Immutable membership periods and balances, separate from customer identity.';
comment on table gym_orders is
  'Commercial orders from POS, member portal or public website.';
comment on table gym_receipts is
  'Internal digital receipts. These are not Mexican CFDI tax invoices.';
