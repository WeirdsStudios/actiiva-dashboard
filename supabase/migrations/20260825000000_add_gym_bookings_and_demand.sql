-- Reservas por ocurrencia y señales de demanda para nuevos horarios.
-- Una clase recurrente se materializa por fecha al reservar; así el calendario
-- no depende de un cron y conserva historial aun cuando cambie la plantilla.

alter table organization_sites
  add column schedule_interest_threshold smallint not null default 5
  check (schedule_interest_threshold between 2 and 50);

alter table gym_classes
  add constraint gym_classes_id_organization_key unique (id, organization_id);

alter table gym_customers
  add constraint gym_customers_id_organization_key unique (id, organization_id);

create table gym_class_reservations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  class_id        uuid not null,
  customer_id     uuid not null,
  class_date      date not null,
  status          text not null check (status in ('reserved', 'waitlisted', 'cancelled', 'attended', 'no_show')),
  requested_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (class_id, customer_id, class_date),
  foreign key (class_id, organization_id)
    references gym_classes(id, organization_id) on delete cascade,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete cascade
);

create index gym_class_reservations_occurrence_idx
on gym_class_reservations(class_id, class_date, status, requested_at);

create trigger gym_class_reservations_updated_at
before update on gym_class_reservations
for each row execute function set_updated_at();

create table gym_schedule_requests (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references organizations(id) on delete cascade,
  class_id              uuid not null,
  customer_id           uuid not null,
  preferred_weekday     smallint not null check (preferred_weekday between 0 and 6),
  preferred_time_window text not null check (preferred_time_window in ('early', 'morning', 'midday', 'evening', 'night')),
  status                text not null default 'open' check (status in ('open', 'scheduled', 'dismissed')),
  requested_at          timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (class_id, customer_id, preferred_weekday, preferred_time_window),
  foreign key (class_id, organization_id)
    references gym_classes(id, organization_id) on delete cascade,
  foreign key (customer_id, organization_id)
    references gym_customers(id, organization_id) on delete cascade
);

create index gym_schedule_requests_demand_idx
on gym_schedule_requests(organization_id, status, class_id, preferred_weekday, preferred_time_window);

create trigger gym_schedule_requests_updated_at
before update on gym_schedule_requests
for each row execute function set_updated_at();

alter table gym_class_reservations enable row level security;
alter table gym_schedule_requests enable row level security;

create policy gym_reservations_read_own
on gym_class_reservations for select to authenticated
using (
  exists (
    select 1 from gym_customers customer
    where customer.id = gym_class_reservations.customer_id
      and customer.organization_id = gym_class_reservations.organization_id
      and customer.user_id = auth.uid()
  )
);

create policy gym_reservations_manager_read
on gym_class_reservations for select to authenticated
using (is_active_organization_manager(organization_id));

create policy gym_schedule_requests_read_own
on gym_schedule_requests for select to authenticated
using (
  exists (
    select 1 from gym_customers customer
    where customer.id = gym_schedule_requests.customer_id
      and customer.organization_id = gym_schedule_requests.organization_id
      and customer.user_id = auth.uid()
  )
);

create policy gym_schedule_requests_manager_read
on gym_schedule_requests for select to authenticated
using (is_active_organization_manager(organization_id));

revoke all on gym_class_reservations, gym_schedule_requests from anon, authenticated;
grant select on gym_class_reservations, gym_schedule_requests to authenticated;

-- Disponibilidad agregada: no expone identidades ni filas de reservación.
create or replace function get_gym_class_availability(
  p_organization_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  class_id uuid,
  class_date date,
  capacity smallint,
  reserved_count integer,
  waitlist_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_from_date is null
     or p_to_date is null
     or p_to_date < p_from_date
     or p_to_date - p_from_date > 31 then
    raise exception 'invalid availability range';
  end if;

  return query
  select
    class_template.id,
    occurrence.day::date,
    class_template.capacity,
    count(reservation.id) filter (where reservation.status = 'reserved')::integer,
    count(reservation.id) filter (where reservation.status = 'waitlisted')::integer
  from gym_classes class_template
  cross join generate_series(p_from_date, p_to_date, interval '1 day') occurrence(day)
  left join gym_class_reservations reservation
    on reservation.class_id = class_template.id
   and reservation.class_date = occurrence.day::date
  where class_template.organization_id = p_organization_id
    and class_template.published = true
    and extract(dow from occurrence.day)::smallint = any(class_template.weekdays)
    and exists (
      select 1 from organization_sites site
      where site.organization_id = class_template.organization_id
        and site.status = 'published'
    )
  group by class_template.id, occurrence.day, class_template.capacity
  order by occurrence.day, class_template.start_time;
end;
$$;

revoke all on function get_gym_class_availability(uuid, date, date) from public;
grant execute on function get_gym_class_availability(uuid, date, date) to anon, authenticated;

-- Reserva con bloqueo por clase/fecha: evita sobreventa bajo concurrencia.
create or replace function gym_reserve_class(p_class_id uuid, p_class_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class gym_classes%rowtype;
  target_customer gym_customers%rowtype;
  existing_status text;
  occupied integer;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select * into target_class
  from gym_classes
  where id = p_class_id
    and published = true;

  if not found then
    raise exception 'class not found';
  end if;

  if p_class_date < current_date
     or p_class_date > current_date + 31
     or not (extract(dow from p_class_date)::smallint = any(target_class.weekdays)) then
    raise exception 'class date is invalid';
  end if;

  select * into target_customer
  from gym_customers
  where organization_id = target_class.organization_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'active membership required';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_class_id::text || ':' || p_class_date::text, 0)
  );

  select status into existing_status
  from gym_class_reservations
  where class_id = p_class_id
    and customer_id = target_customer.id
    and class_date = p_class_date;

  if existing_status in ('reserved', 'waitlisted') then
    return existing_status;
  end if;

  select count(*)::integer into occupied
  from gym_class_reservations
  where class_id = p_class_id
    and class_date = p_class_date
    and status = 'reserved';

  next_status := case when occupied < target_class.capacity then 'reserved' else 'waitlisted' end;

  insert into gym_class_reservations (
    organization_id, class_id, customer_id, class_date, status
  ) values (
    target_class.organization_id, target_class.id, target_customer.id, p_class_date, next_status
  )
  on conflict (class_id, customer_id, class_date)
  do update set
    status = excluded.status,
    requested_at = now(),
    updated_at = now();

  return next_status;
end;
$$;

revoke all on function gym_reserve_class(uuid, date) from public, anon;
grant execute on function gym_reserve_class(uuid, date) to authenticated;

-- Al cancelar un lugar confirmado, la primera persona en espera asciende.
create or replace function gym_cancel_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target gym_class_reservations%rowtype;
  promoted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select reservation.* into target
  from gym_class_reservations reservation
  where reservation.id = p_reservation_id
    and exists (
      select 1 from gym_customers customer
      where customer.id = reservation.customer_id
        and customer.user_id = auth.uid()
    )
  for update;

  if not found or target.status not in ('reserved', 'waitlisted') then
    raise exception 'active reservation not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target.class_id::text || ':' || target.class_date::text, 0)
  );

  update gym_class_reservations
  set status = 'cancelled'
  where id = target.id;

  if target.status = 'reserved' then
    select id into promoted_id
    from gym_class_reservations
    where class_id = target.class_id
      and class_date = target.class_date
      and status = 'waitlisted'
    order by requested_at, id
    for update skip locked
    limit 1;

    if promoted_id is not null then
      update gym_class_reservations
      set status = 'reserved'
      where id = promoted_id;
    end if;
  end if;

  return promoted_id is not null;
end;
$$;

revoke all on function gym_cancel_reservation(uuid) from public, anon;
grant execute on function gym_cancel_reservation(uuid) to authenticated;

create or replace function gym_request_schedule(
  p_class_id uuid,
  p_preferred_weekday smallint,
  p_preferred_time_window text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class gym_classes%rowtype;
  target_customer gym_customers%rowtype;
  request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if p_preferred_weekday not between 0 and 6
     or p_preferred_time_window not in ('early', 'morning', 'midday', 'evening', 'night') then
    raise exception 'schedule preference is invalid';
  end if;

  select * into target_class
  from gym_classes
  where id = p_class_id
    and published = true;

  if not found then
    raise exception 'class not found';
  end if;

  select * into target_customer
  from gym_customers
  where organization_id = target_class.organization_id
    and user_id = auth.uid()
    and status = 'active';

  if not found then
    raise exception 'active membership required';
  end if;

  insert into gym_schedule_requests (
    organization_id,
    class_id,
    customer_id,
    preferred_weekday,
    preferred_time_window,
    status
  ) values (
    target_class.organization_id,
    target_class.id,
    target_customer.id,
    p_preferred_weekday,
    p_preferred_time_window,
    'open'
  )
  on conflict (class_id, customer_id, preferred_weekday, preferred_time_window)
  do update set
    status = 'open',
    requested_at = now(),
    updated_at = now()
  returning id into request_id;

  return request_id;
end;
$$;

revoke all on function gym_request_schedule(uuid, smallint, text) from public, anon;
grant execute on function gym_request_schedule(uuid, smallint, text) to authenticated;

comment on table gym_class_reservations is
  'Bookings for concrete occurrences of recurring gym classes.';
comment on table gym_schedule_requests is
  'Member demand signals used to decide when to open additional schedules.';
