-- Reservations now honor real membership periods, grace days and class credits.

create or replace function gym_reserve_class(p_class_id uuid, p_class_date date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target_class gym_classes%rowtype;
  target_customer gym_customers%rowtype;
  target_membership gym_customer_memberships%rowtype;
  class_access_value text;
  existing_status text;
  occupied integer;
  next_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into target_class from gym_classes where id = p_class_id and published = true;
  if not found then raise exception 'class not found'; end if;

  if p_class_date < current_date
     or p_class_date > current_date + 31
     or not (extract(dow from p_class_date)::smallint = any(target_class.weekdays))
     or (p_class_date::timestamp + target_class.start_time) <= (now() at time zone 'America/Mexico_City') then
    raise exception 'class date is invalid';
  end if;

  select * into target_customer from gym_customers
  where organization_id = target_class.organization_id
    and user_id = auth.uid() and status = 'active';
  if not found then raise exception 'active customer required'; end if;

  update gym_customer_memberships set status = 'expired'
  where customer_id = target_customer.id
    and status = 'active' and grace_ends_on < current_date;

  select membership.* into target_membership
  from gym_customer_memberships membership
  where membership.customer_id = target_customer.id
    and membership.status = 'active'
    and membership.starts_on <= current_date
    and membership.grace_ends_on >= current_date
  order by membership.ends_on desc limit 1;
  if not found then raise exception 'active membership required'; end if;

  select class_access into class_access_value
  from gym_membership_plans where id = target_membership.plan_id;
  if class_access_value = 'none' then raise exception 'active membership required'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_class_id::text || ':' || p_class_date::text, 0));

  select status into existing_status from gym_class_reservations
  where class_id = p_class_id and customer_id = target_customer.id and class_date = p_class_date;
  if existing_status in ('reserved', 'waitlisted') then return existing_status; end if;

  select count(*)::integer into occupied from gym_class_reservations
  where class_id = p_class_id and class_date = p_class_date and status = 'reserved';
  next_status := case when occupied < target_class.capacity then 'reserved' else 'waitlisted' end;

  if next_status = 'reserved' and class_access_value = 'credits'
     and target_membership.class_credits_used >= coalesce(target_membership.class_credits_total, 0) then
    raise exception 'class credits exhausted';
  end if;

  insert into gym_class_reservations (
    organization_id, class_id, customer_id, class_date, status
  ) values (
    target_class.organization_id, target_class.id, target_customer.id, p_class_date, next_status
  )
  on conflict (class_id, customer_id, class_date)
  do update set status = excluded.status, requested_at = now(), updated_at = now();

  if next_status = 'reserved' and class_access_value = 'credits' then
    update gym_customer_memberships set class_credits_used = class_credits_used + 1
    where id = target_membership.id;
  end if;

  return next_status;
end;
$$;

revoke all on function gym_reserve_class(uuid, date) from public, anon;
grant execute on function gym_reserve_class(uuid, date) to authenticated;

create or replace function gym_cancel_reservation(p_reservation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target gym_class_reservations%rowtype;
  target_membership_id uuid;
  target_class_access text;
  promoted record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select reservation.* into target
  from gym_class_reservations reservation
  where reservation.id = p_reservation_id
    and exists (
      select 1 from gym_customers customer
      where customer.id = reservation.customer_id and customer.user_id = auth.uid()
    )
  for update;
  if not found or target.status not in ('reserved', 'waitlisted') then
    raise exception 'active reservation not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target.class_id::text || ':' || target.class_date::text, 0));

  if target.status = 'reserved' then
    select membership.id, plan.class_access into target_membership_id, target_class_access
    from gym_customer_memberships membership
    join gym_membership_plans plan on plan.id = membership.plan_id
    where membership.customer_id = target.customer_id
      and membership.status = 'active'
      and membership.starts_on <= target.class_date
      and membership.grace_ends_on >= target.class_date
    order by membership.ends_on desc limit 1;

    if target_class_access = 'credits' then
      update gym_customer_memberships
      set class_credits_used = greatest(class_credits_used - 1, 0)
      where id = target_membership_id;
    end if;
  end if;

  update gym_class_reservations set status = 'cancelled' where id = target.id;

  if target.status = 'reserved' then
    select reservation.id, membership.id as membership_id, plan.class_access
    into promoted
    from gym_class_reservations reservation
    join gym_customer_memberships membership on membership.customer_id = reservation.customer_id
      and membership.status = 'active'
      and membership.starts_on <= reservation.class_date
      and membership.grace_ends_on >= reservation.class_date
    join gym_membership_plans plan on plan.id = membership.plan_id
    where reservation.class_id = target.class_id
      and reservation.class_date = target.class_date
      and reservation.status = 'waitlisted'
      and (plan.class_access = 'unlimited'
        or (plan.class_access = 'credits' and membership.class_credits_used < coalesce(membership.class_credits_total, 0)))
    order by reservation.requested_at, reservation.id
    for update of reservation skip locked
    limit 1;

    if promoted.id is not null then
      update gym_class_reservations set status = 'reserved' where id = promoted.id;
      if promoted.class_access = 'credits' then
        update gym_customer_memberships set class_credits_used = class_credits_used + 1
        where id = promoted.membership_id;
      end if;
    end if;
  end if;

  return promoted.id is not null;
end;
$$;

revoke all on function gym_cancel_reservation(uuid) from public, anon;
grant execute on function gym_cancel_reservation(uuid) to authenticated;
