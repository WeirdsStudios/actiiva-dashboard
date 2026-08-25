-- Member self-service required by WhatsApp notifications and extra-class holds.

create or replace function gym_update_customer_profile(p_name text, p_phone text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := trim(coalesce(p_name, ''));
  clean_phone text := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');
begin
  if auth.uid() is null
     or char_length(clean_name) not between 1 and 120
     or (clean_phone <> '' and clean_phone !~ '^\+?[0-9]{10,15}$') then
    raise exception 'invalid profile';
  end if;

  update gym_customers set name = clean_name, phone = clean_phone
  where user_id = auth.uid();
  return found;
end;
$$;

revoke all on function gym_update_customer_profile(text, text) from public, anon;
grant execute on function gym_update_customer_profile(text, text) to authenticated;

create or replace function gym_confirm_class_hold(p_public_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hold gym_class_holds%rowtype;
  target_occurrence gym_extra_class_occurrences%rowtype;
  confirmation_count integer;
  confirmation_threshold integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  update gym_class_holds set status = 'expired'
  where status = 'pending' and expires_at <= now();

  select hold.* into target_hold
  from gym_class_holds hold
  join gym_customers customer on customer.id = hold.customer_id
  where hold.public_token = p_public_token
    and customer.user_id = auth.uid()
    and hold.status = 'pending'
    and hold.expires_at > now()
  for update;
  if not found then raise exception 'active hold not found'; end if;

  select * into target_occurrence from gym_extra_class_occurrences
  where id = target_hold.occurrence_id and status = 'authorized'
  for update;
  if not found then raise exception 'extra class unavailable'; end if;
  if target_occurrence.price_cents > 0 then raise exception 'payment required'; end if;

  update gym_class_holds set status = 'confirmed', confirmed_at = now()
  where id = target_hold.id;

  select count(*)::integer into confirmation_count
  from gym_class_holds where occurrence_id = target_occurrence.id and status = 'confirmed';
  select schedule_interest_threshold into confirmation_threshold
  from organization_sites where organization_id = target_occurrence.organization_id;

  if confirmation_count >= least(confirmation_threshold, target_occurrence.capacity) then
    update gym_extra_class_occurrences set status = 'confirmed'
    where id = target_occurrence.id;
  end if;

  insert into gym_notification_outbox (
    organization_id, customer_id, channel, template_key, recipient, payload, status
  ) values (
    target_occurrence.organization_id, target_hold.customer_id, 'in_app',
    'extra_class_hold_confirmed', '',
    jsonb_build_object('occurrenceId', target_occurrence.id, 'startsAt', target_occurrence.starts_at),
    'draft'
  );

  return true;
end;
$$;

revoke all on function gym_confirm_class_hold(uuid) from public, anon;
grant execute on function gym_confirm_class_hold(uuid) to authenticated;
