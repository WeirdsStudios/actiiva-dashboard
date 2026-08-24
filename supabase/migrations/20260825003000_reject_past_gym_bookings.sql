-- La fecha por sí sola no basta: impide reservar una clase de hoy después de
-- su hora de inicio usando la zona horaria operativa del producto.

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
     or not (extract(dow from p_class_date)::smallint = any(target_class.weekdays))
     or (p_class_date::timestamp + target_class.start_time) <= (now() at time zone 'America/Mexico_City') then
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
