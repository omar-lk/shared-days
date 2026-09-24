-- Apply only after 20260916000000_itemized_expenses.sql.
-- Reuse the existing create function's validation for every edited item.
begin;

create function public.update_itemized_expense(
  p_expense_id uuid,
  p_payer_member_id uuid,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
  v_replacement_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select e.group_id into v_group_id
  from public.expenses e
  join public.groups g on g.id = e.group_id
  where e.id = p_expense_id
    and g.created_by = (select auth.uid())
  for update of e;

  if v_group_id is null then
    raise exception 'Only the group creator can edit this expense';
  end if;

  -- This call validates the payer, every item and every allocation. It also
  -- creates a temporary replacement inside this same transaction.
  v_replacement_id := public.create_itemized_expense(
    v_group_id, p_payer_member_id, p_items
  );

  delete from public.expense_items
  where expense_id = p_expense_id and group_id = v_group_id;

  update public.expenses original
  set payer_member_id = replacement.payer_member_id,
      total_minor = replacement.total_minor
  from public.expenses replacement
  where original.id = p_expense_id
    and replacement.id = v_replacement_id;

  update public.expense_items
  set expense_id = p_expense_id
  where expense_id = v_replacement_id and group_id = v_group_id;

  delete from public.expenses where id = v_replacement_id;
  return p_expense_id;
end;
$$;

revoke all on function public.update_itemized_expense(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.update_itemized_expense(uuid, uuid, jsonb)
  to authenticated;

commit;
