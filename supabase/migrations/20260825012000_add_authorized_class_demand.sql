-- Demand may only originate from a real waitlist. Reaching the threshold is a
-- signal; a manager still chooses the concrete extra session before any hold.

alter table gym_customers add column phone text not null default '';

alter table gym_schedule_requests
  add column source_reservation_id uuid references gym_class_reservations(id) on delete set null;

-- The original demo requests were free-form and cannot prove a waitlist.
update gym_schedule_requests set status = 'dismissed'
where source_reservation_id is null and status = 'open';

create table gym_extra_class_occurrences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  branch_id             uuid not null,
  class_id              uuid not null,
  source_weekday        smallint not null check (source_weekday between 0 and 6),
  source_time_window    text not null check (source_time_window in ('early', 'morning', 'midday', 'evening', 'night')),
  starts_at             timestamptz not null,
  duration_minutes      smallint not null check (duration_minutes between 15 and 180),
  capacity              smallint not null check (capacity between 1 and 200),
  price_cents           integer not null default 0 check (price_cents >= 0),
  status                text not null default 'authorized'
                        check (status in ('authorized', 'confirmed', 'cancelled', 'completed')),
  approved_by           uuid not null references auth.users(id) on delete restrict,
  approved_at           timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (branch_id, organization_id)
    references gym_branches(id, organization_id) on delete restrict,
  foreign key (class_id, organization_id)
    references gym_classes(id, organization_id) on delete restrict,
  unique (id, organization_id)
);

create index gym_extra_occurrences_upcoming_idx
on gym_extra_class_occurrences(organization_id, starts_at) where status in ('authorized', 'confirmed');

create trigger gym_extra_class_occurrences_updated_at
before update on gym_extra_class_occurrences
for each row execute function set_updated_at();

create table gym_class_holds (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  occurrence_id         uuid not null,
  customer_id           uuid not null,
  source_request_id     uuid references gym_schedule_requests(id) on delete set null,
  public_token          uuid not null default gen_random_uuid() unique,
  status                text not null default 'pending'
                        check (status in ('pending', 'confirmed', 'expired', 'cancelled')),
  expires_at            timestamptz not null,
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  foreign key (occurrence_id, organization_id)
    references gym_extra_class_occurrences(id, organization_id) on delete cascade,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete cascade,
  unique (occurrence_id, customer_id)
);

create trigger gym_class_holds_updated_at
before update on gym_class_holds
for each row execute function set_updated_at();

create table gym_notification_outbox (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  customer_id           uuid references gym_customers(id) on delete cascade,
  channel               text not null check (channel in ('whatsapp', 'email', 'in_app')),
  template_key          text not null check (char_length(template_key) between 1 and 80),
  recipient             text not null default '',
  payload               jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status                text not null default 'draft'
                        check (status in ('draft', 'queued', 'sent', 'failed', 'cancelled')),
  sent_at               timestamptz,
  error_message         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index gym_notification_outbox_pending_idx
on gym_notification_outbox(organization_id, status, created_at);

create trigger gym_notification_outbox_updated_at
before update on gym_notification_outbox
for each row execute function set_updated_at();

alter table gym_extra_class_occurrences enable row level security;
alter table gym_class_holds enable row level security;
alter table gym_notification_outbox enable row level security;

create policy gym_extra_occurrences_member_read on gym_extra_class_occurrences for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.organization_id = gym_extra_class_occurrences.organization_id
    and customer.user_id = auth.uid()
));
create policy gym_extra_occurrences_manager_all on gym_extra_class_occurrences for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_class_holds_read_own on gym_class_holds for select to authenticated
using (exists (
  select 1 from gym_customers customer
  where customer.id = gym_class_holds.customer_id and customer.user_id = auth.uid()
));
create policy gym_class_holds_manager_all on gym_class_holds for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

create policy gym_notification_outbox_manager_all on gym_notification_outbox for all to authenticated
using (is_active_organization_manager(organization_id))
with check (is_active_organization_manager(organization_id));

revoke all on gym_extra_class_occurrences, gym_class_holds, gym_notification_outbox from anon, authenticated;
grant select on gym_extra_class_occurrences, gym_class_holds to authenticated;
grant select, insert, update, delete on gym_extra_class_occurrences, gym_class_holds, gym_notification_outbox to authenticated;

drop function if exists gym_request_schedule(uuid, smallint, text);

create function gym_request_schedule(
  p_source_reservation_id uuid,
  p_preferred_weekday smallint,
  p_preferred_time_window text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_reservation gym_class_reservations%rowtype;
  target_customer gym_customers%rowtype;
  request_id uuid;
begin
  if auth.uid() is null
     or p_preferred_weekday not between 0 and 6
     or p_preferred_time_window not in ('early', 'morning', 'midday', 'evening', 'night') then
    raise exception 'schedule preference is invalid';
  end if;

  select reservation.* into target_reservation
  from gym_class_reservations reservation
  join gym_customers customer on customer.id = reservation.customer_id
  where reservation.id = p_source_reservation_id
    and reservation.status = 'waitlisted'
    and customer.user_id = auth.uid();
  if not found then raise exception 'active waitlist required'; end if;

  select * into target_customer from gym_customers
  where id = target_reservation.customer_id
    and organization_id = target_reservation.organization_id
    and status = 'active';
  if not found then raise exception 'active membership required'; end if;

  insert into gym_schedule_requests (
    organization_id, class_id, customer_id, preferred_weekday,
    preferred_time_window, source_reservation_id, status
  ) values (
    target_reservation.organization_id, target_reservation.class_id,
    target_reservation.customer_id, p_preferred_weekday,
    p_preferred_time_window, target_reservation.id, 'open'
  )
  on conflict (class_id, customer_id, preferred_weekday, preferred_time_window)
  do update set
    source_reservation_id = excluded.source_reservation_id,
    status = 'open', requested_at = now(), updated_at = now()
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function gym_request_schedule(uuid, smallint, text) from public, anon;
grant execute on function gym_request_schedule(uuid, smallint, text) to authenticated;

create or replace function gym_approve_demand(
  p_class_id uuid,
  p_preferred_weekday smallint,
  p_preferred_time_window text,
  p_branch_id uuid,
  p_starts_at timestamptz,
  p_capacity smallint,
  p_price_cents integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class gym_classes%rowtype;
  target_site organization_sites%rowtype;
  target_branch gym_branches%rowtype;
  occurrence_id uuid;
  hold_expires_at timestamptz;
  request_row record;
  hold_token uuid;
  request_count integer;
  hold_count integer := 0;
begin
  if auth.uid() is null or p_capacity < 1 or p_capacity > 200 or p_price_cents < 0
     or p_starts_at <= now() + interval '1 hour' or p_preferred_weekday not between 0 and 6
     or p_preferred_time_window not in ('early', 'morning', 'midday', 'evening', 'night') then
    raise exception 'invalid extra class';
  end if;

  select * into target_class from gym_classes where id = p_class_id;
  if not found or not is_active_organization_manager(target_class.organization_id) then
    raise exception 'manager access required';
  end if;
  select * into target_site from organization_sites where organization_id = target_class.organization_id;
  select * into target_branch from gym_branches
  where id = p_branch_id and organization_id = target_class.organization_id and status = 'active';
  if not found then raise exception 'branch not found'; end if;

  select count(distinct customer_id)::integer into request_count
  from gym_schedule_requests
  where organization_id = target_class.organization_id
    and class_id = target_class.id
    and preferred_weekday = p_preferred_weekday
    and preferred_time_window = p_preferred_time_window
    and status = 'open';
  if request_count < target_site.schedule_interest_threshold then
    raise exception 'demand threshold not reached';
  end if;

  insert into gym_extra_class_occurrences (
    organization_id, branch_id, class_id, source_weekday, source_time_window,
    starts_at, duration_minutes, capacity, price_cents, approved_by
  ) values (
    target_class.organization_id, target_branch.id, target_class.id,
    p_preferred_weekday, p_preferred_time_window, p_starts_at,
    target_class.duration_minutes, p_capacity, p_price_cents, auth.uid()
  ) returning id into occurrence_id;

  hold_expires_at := least(
    now() + make_interval(hours => target_site.demand_hold_hours),
    p_starts_at - interval '1 hour'
  );

  for request_row in
    select request.id, request.customer_id, customer.phone, customer.name
    from gym_schedule_requests request
    join gym_customers customer on customer.id = request.customer_id
    where request.organization_id = target_class.organization_id
      and request.class_id = target_class.id
      and request.preferred_weekday = p_preferred_weekday
      and request.preferred_time_window = p_preferred_time_window
      and request.status = 'open'
    order by request.requested_at
    limit p_capacity
  loop
    insert into gym_class_holds (
      organization_id, occurrence_id, customer_id, source_request_id, expires_at
    ) values (
      target_class.organization_id, occurrence_id, request_row.customer_id,
      request_row.id, hold_expires_at
    ) returning public_token into hold_token;
    hold_count := hold_count + 1;

    insert into gym_notification_outbox (
      organization_id, customer_id, channel, template_key, recipient, payload, status
    ) values (
      target_class.organization_id, request_row.customer_id, 'whatsapp',
      'extra_class_hold_created', request_row.phone,
      jsonb_build_object(
        'customerName', request_row.name,
        'className', target_class.name,
        'startsAt', p_starts_at,
        'expiresAt', hold_expires_at,
        'priceCents', p_price_cents,
        'paymentPath', '/mi-cuenta/apartados/' || hold_token::text
      ),
      'draft'
    );

    update gym_schedule_requests set status = 'scheduled'
    where id = request_row.id;
  end loop;

  return jsonb_build_object(
    'occurrenceId', occurrence_id,
    'holdCount', hold_count,
    'holdExpiresAt', hold_expires_at
  );
end;
$$;

revoke all on function gym_approve_demand(uuid, smallint, text, uuid, timestamptz, smallint, integer) from public, anon;
grant execute on function gym_approve_demand(uuid, smallint, text, uuid, timestamptz, smallint, integer) to authenticated;

comment on table gym_class_holds is
  'Temporary spots created only after a manager authorizes an extra class.';
comment on table gym_notification_outbox is
  'Auditable notification drafts. A separate provider worker sends them after formal connection.';
