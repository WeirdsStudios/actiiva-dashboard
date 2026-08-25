-- Atomic operations for the first ACTIIVA POS. All prices are read from the
-- catalog on the server; clients cannot submit arbitrary totals.

create or replace function gym_open_cash_session(
  p_branch_id uuid,
  p_opening_amount_cents integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_branch gym_branches%rowtype;
  session_id uuid;
begin
  if auth.uid() is null or p_opening_amount_cents < 0 then
    raise exception 'invalid cash session';
  end if;

  select * into target_branch from gym_branches
  where id = p_branch_id and status = 'active';
  if not found or not is_active_organization_manager(target_branch.organization_id) then
    raise exception 'manager access required';
  end if;

  insert into gym_cash_sessions (
    organization_id, branch_id, opened_by, opening_amount_cents
  ) values (
    target_branch.organization_id, target_branch.id, auth.uid(), p_opening_amount_cents
  )
  returning id into session_id;

  return session_id;
end;
$$;

revoke all on function gym_open_cash_session(uuid, integer) from public, anon;
grant execute on function gym_open_cash_session(uuid, integer) to authenticated;

create or replace function gym_close_cash_session(
  p_session_id uuid,
  p_closing_amount_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session gym_cash_sessions%rowtype;
  cash_sales integer;
  expected integer;
begin
  if auth.uid() is null or p_closing_amount_cents < 0 then
    raise exception 'invalid cash session';
  end if;

  select * into target_session from gym_cash_sessions
  where id = p_session_id and status = 'open'
  for update;
  if not found or not is_active_organization_manager(target_session.organization_id) then
    raise exception 'open cash session not found';
  end if;

  select coalesce(sum(payment.amount_cents), 0)::integer into cash_sales
  from gym_payments payment
  join gym_orders gym_order on gym_order.id = payment.order_id
  where payment.organization_id = target_session.organization_id
    and gym_order.branch_id = target_session.branch_id
    and payment.payment_method = 'cash'
    and payment.status = 'approved'
    and payment.paid_at >= target_session.opened_at;

  expected := target_session.opening_amount_cents + cash_sales;

  update gym_cash_sessions set
    status = 'closed',
    closed_by = auth.uid(),
    expected_amount_cents = expected,
    closing_amount_cents = p_closing_amount_cents,
    closed_at = now()
  where id = target_session.id;

  return jsonb_build_object(
    'sessionId', target_session.id,
    'expectedAmountCents', expected,
    'closingAmountCents', p_closing_amount_cents,
    'differenceCents', p_closing_amount_cents - expected
  );
end;
$$;

revoke all on function gym_close_cash_session(uuid, integer) from public, anon;
grant execute on function gym_close_cash_session(uuid, integer) to authenticated;

create or replace function gym_record_sale(
  p_branch_id uuid,
  p_customer_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_branch gym_branches%rowtype;
  target_customer gym_customers%rowtype;
  target_item gym_catalog_items%rowtype;
  target_plan gym_membership_plans%rowtype;
  current_membership gym_customer_memberships%rowtype;
  line record;
  order_id uuid;
  order_item_id uuid;
  receipt_token uuid;
  order_number_value bigint;
  subtotal integer := 0;
  starts_on_value date;
  ends_on_value date;
  membership_status text;
begin
  if auth.uid() is null
     or p_payment_method not in ('cash', 'card', 'bank_transfer')
     or p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 30 then
    raise exception 'invalid sale';
  end if;

  select * into target_branch from gym_branches
  where id = p_branch_id and status = 'active';
  if not found or not is_active_organization_manager(target_branch.organization_id) then
    raise exception 'manager access required';
  end if;

  if p_customer_id is not null then
    select * into target_customer from gym_customers
    where id = p_customer_id and organization_id = target_branch.organization_id;
    if not found then raise exception 'customer not found'; end if;
  end if;

  if p_payment_method = 'cash' and not exists (
    select 1 from gym_cash_sessions
    where branch_id = target_branch.id and status = 'open'
  ) then
    raise exception 'open cash session required';
  end if;

  insert into gym_orders (
    organization_id, branch_id, customer_id, status, source,
    subtotal_cents, total_cents, created_by, paid_at
  ) values (
    target_branch.organization_id, target_branch.id, p_customer_id, 'paid', 'pos',
    0, 0, auth.uid(), now()
  ) returning id, order_number into order_id, order_number_value;

  for line in
    select value->>'catalogItemId' as catalog_item_id,
           (value->>'quantity')::integer as quantity
    from jsonb_array_elements(p_items)
  loop
    if line.quantity is null or line.quantity < 1 or line.quantity > 100 then
      raise exception 'invalid item quantity';
    end if;

    select * into target_item from gym_catalog_items
    where id = line.catalog_item_id::uuid
      and organization_id = target_branch.organization_id
      and active = true
    for update;
    if not found then raise exception 'catalog item not found'; end if;

    if target_item.item_type = 'membership' and (p_customer_id is null or line.quantity <> 1) then
      raise exception 'membership requires one customer';
    end if;

    if target_item.tracks_inventory then
      if not exists (
        select 1 from gym_inventory_levels
        where branch_id = target_branch.id
          and catalog_item_id = target_item.id
          and quantity >= line.quantity
        for update
      ) then
        raise exception 'insufficient inventory for %', target_item.name;
      end if;
    end if;

    insert into gym_order_items (
      organization_id, order_id, catalog_item_id, item_type,
      description, quantity, unit_price_cents, total_cents
    ) values (
      target_branch.organization_id, order_id, target_item.id, target_item.item_type,
      target_item.name, line.quantity, target_item.price_cents,
      line.quantity * target_item.price_cents
    ) returning id into order_item_id;

    subtotal := subtotal + (line.quantity * target_item.price_cents);

    if target_item.tracks_inventory then
      update gym_inventory_levels
      set quantity = quantity - line.quantity, updated_at = now()
      where branch_id = target_branch.id and catalog_item_id = target_item.id;

      insert into gym_inventory_movements (
        organization_id, branch_id, catalog_item_id, order_item_id,
        quantity_delta, reason, note, created_by
      ) values (
        target_branch.organization_id, target_branch.id, target_item.id, order_item_id,
        -line.quantity, 'sale', 'Venta POS', auth.uid()
      );
    end if;

    if target_item.item_type = 'membership' then
      select * into target_plan from gym_membership_plans
      where id = target_item.membership_plan_id;

      update gym_customer_memberships
      set status = 'expired'
      where customer_id = p_customer_id
        and status in ('active', 'paused')
        and grace_ends_on < current_date;

      select * into current_membership from gym_customer_memberships
      where customer_id = p_customer_id
        and status in ('active', 'paused')
      order by ends_on desc limit 1;

      if found then
        starts_on_value := current_membership.ends_on + 1;
        membership_status := 'pending';
      else
        starts_on_value := current_date;
        membership_status := 'active';
      end if;

      ends_on_value := case target_plan.duration_unit
        when 'day' then (starts_on_value + target_plan.duration_count - 1)::date
        when 'week' then (starts_on_value + (target_plan.duration_count * 7) - 1)::date
        when 'month' then (starts_on_value + (target_plan.duration_count || ' months')::interval - interval '1 day')::date
        when 'year' then (starts_on_value + (target_plan.duration_count || ' years')::interval - interval '1 day')::date
      end;

      insert into gym_customer_memberships (
        organization_id, customer_id, plan_id, status, starts_on, ends_on,
        grace_ends_on, price_cents, class_credits_total, auto_renew, source
      ) values (
        target_branch.organization_id, p_customer_id, target_plan.id, membership_status,
        starts_on_value, ends_on_value, ends_on_value + target_plan.grace_days,
        target_item.price_cents,
        case when target_plan.class_access = 'credits' then target_plan.class_credits else null end,
        false, 'pos'
      );

      if membership_status = 'active' then
        update gym_customers set
          plan_id = target_plan.id,
          status = 'active',
          joined_on = coalesce(joined_on, starts_on_value),
          next_payment_on = ends_on_value + 1
        where id = p_customer_id;
      end if;
    end if;
  end loop;

  if subtotal <= 0 then raise exception 'sale total must be positive'; end if;

  update gym_orders set subtotal_cents = subtotal, total_cents = subtotal
  where id = order_id;

  insert into gym_payments (
    organization_id, order_id, customer_id, payment_method, status,
    amount_cents, reference, received_by, paid_at
  ) values (
    target_branch.organization_id, order_id, p_customer_id, p_payment_method,
    'approved', subtotal, nullif(trim(p_reference), ''), auth.uid(), now()
  );

  insert into gym_receipts (organization_id, order_id, customer_id)
  values (target_branch.organization_id, order_id, p_customer_id)
  returning public_token into receipt_token;

  return jsonb_build_object(
    'orderId', order_id,
    'orderNumber', order_number_value,
    'totalCents', subtotal,
    'receiptToken', receipt_token
  );
end;
$$;

revoke all on function gym_record_sale(uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function gym_record_sale(uuid, uuid, jsonb, text, text) to authenticated;

create or replace function gym_adjust_inventory(
  p_branch_id uuid,
  p_catalog_item_id uuid,
  p_quantity_delta integer,
  p_note text default ''
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_branch gym_branches%rowtype;
  target_item gym_catalog_items%rowtype;
  resulting_quantity integer;
begin
  if auth.uid() is null or p_quantity_delta = 0 or abs(p_quantity_delta) > 100000 then
    raise exception 'invalid inventory adjustment';
  end if;

  select * into target_branch from gym_branches where id = p_branch_id;
  if not found or not is_active_organization_manager(target_branch.organization_id) then
    raise exception 'manager access required';
  end if;

  select * into target_item from gym_catalog_items
  where id = p_catalog_item_id
    and organization_id = target_branch.organization_id
    and tracks_inventory = true;
  if not found then raise exception 'inventory item not found'; end if;

  insert into gym_inventory_levels (
    organization_id, branch_id, catalog_item_id, quantity
  ) values (
    target_branch.organization_id, target_branch.id, target_item.id, p_quantity_delta
  )
  on conflict (branch_id, catalog_item_id) do update
  set quantity = gym_inventory_levels.quantity + excluded.quantity,
      updated_at = now()
  returning quantity into resulting_quantity;

  if resulting_quantity < 0 then raise exception 'inventory cannot be negative'; end if;

  insert into gym_inventory_movements (
    organization_id, branch_id, catalog_item_id, quantity_delta,
    reason, note, created_by
  ) values (
    target_branch.organization_id, target_branch.id, target_item.id, p_quantity_delta,
    case when p_quantity_delta > 0 then 'restock' else 'adjustment' end,
    left(coalesce(p_note, ''), 300), auth.uid()
  );

  return resulting_quantity;
end;
$$;

revoke all on function gym_adjust_inventory(uuid, uuid, integer, text) from public, anon;
grant execute on function gym_adjust_inventory(uuid, uuid, integer, text) to authenticated;
