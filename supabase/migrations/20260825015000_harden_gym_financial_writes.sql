-- Financial records are readable under RLS, but writes must pass through the
-- validated security-definer operations instead of arbitrary table mutations.

alter table gym_inventory_levels
  add constraint gym_inventory_levels_nonnegative_quantity check (quantity >= 0);

alter table gym_customer_memberships
  add constraint gym_customer_memberships_credit_balance check (
    class_credits_total is null or class_credits_used <= class_credits_total
  );

revoke insert, update, delete on
  gym_customer_memberships,
  gym_orders,
  gym_order_items,
  gym_payments,
  gym_receipts,
  gym_cash_sessions,
  gym_inventory_levels,
  gym_inventory_movements,
  gym_extra_class_occurrences,
  gym_class_holds,
  gym_notification_outbox
from authenticated;

grant select on
  gym_customer_memberships,
  gym_orders,
  gym_order_items,
  gym_payments,
  gym_receipts,
  gym_cash_sessions,
  gym_inventory_levels,
  gym_inventory_movements,
  gym_extra_class_occurrences,
  gym_class_holds,
  gym_notification_outbox
to authenticated;
