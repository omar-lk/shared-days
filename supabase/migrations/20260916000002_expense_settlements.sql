-- Apply after 20260916000001_update_itemized_expenses.sql.
-- A row means the group creator explicitly marked one full expense share paid.
begin;

do $$
begin
  if to_regprocedure('public.update_itemized_expense(uuid,uuid,jsonb)') is null then
    raise exception 'Apply the itemized expense update migration first';
  end if;
end;
$$;

create table public.expense_settlements (
  expense_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  payer_member_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 9007199254740991),
  marked_paid_at timestamptz not null default now(),
  marked_by uuid not null,
  primary key (expense_id, member_id),
  check (member_id <> payer_member_id),
  foreign key (expense_id, group_id)
    references public.expenses (id, group_id) on delete cascade,
  foreign key (group_id, member_id)
    references public.group_members (group_id, id),
  foreign key (group_id, payer_member_id)
    references public.group_members (group_id, id)
);

create index expense_settlements_group_id_idx
  on public.expense_settlements (group_id);

alter table public.expense_settlements enable row level security;
create policy expense_settlements_read_group_member
  on public.expense_settlements for select to authenticated
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = expense_settlements.group_id
      and gm.user_id = (select auth.uid())
  ));

revoke all on public.expense_settlements from public, anon, authenticated;
grant select on public.expense_settlements to authenticated;

-- The existing edit function updates the expense header after replacing its
-- items. Reject that update if any share was marked paid; its statement then
-- rolls back the entire replacement. Deleting a group still cascades normally.
create function public.prevent_settled_expense_edit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.expense_settlements s
    where s.expense_id = old.id
  ) then
    raise exception 'Mark all shares unpaid before editing this expense';
  end if;
  return new;
end;
$$;

create trigger prevent_settled_expense_edit
before update of payer_member_id, total_minor on public.expenses
for each row execute function public.prevent_settled_expense_edit();

revoke all on function public.prevent_settled_expense_edit()
  from public, anon, authenticated;

create function public.set_expense_paid_status(
  p_expense_id uuid,
  p_member_id uuid,
  p_paid boolean
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
  v_share numeric;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;
  if p_paid is null then
    raise exception 'Paid status is required';
  end if;

  select e.* into v_expense
  from public.expenses e
  join public.groups g on g.id = e.group_id
  where e.id = p_expense_id
    and g.created_by = (select auth.uid())
  for update of e;

  if not found then
    raise exception 'Only the group creator can update paid status';
  end if;
  if p_member_id = v_expense.payer_member_id then
    raise exception 'The payer does not owe themselves';
  end if;

  select coalesce(sum(a.amount_minor), 0) into v_share
  from public.expense_items i
  join public.item_allocations a on a.item_id = i.id
    and a.group_id = i.group_id
  where i.expense_id = p_expense_id
    and i.group_id = v_expense.group_id
    and a.member_id = p_member_id;

  if v_share <= 0 then
    raise exception 'Member has no amount due on this expense';
  end if;

  if p_paid then
    insert into public.expense_settlements (
      expense_id, group_id, member_id, payer_member_id,
      amount_minor, marked_by
    ) values (
      p_expense_id, v_expense.group_id, p_member_id,
      v_expense.payer_member_id, v_share::bigint, (select auth.uid())
    ) on conflict (expense_id, member_id) do nothing;
  else
    delete from public.expense_settlements
    where expense_id = p_expense_id and member_id = p_member_id;
  end if;

  return p_paid;
end;
$$;

revoke all on function public.set_expense_paid_status(uuid, uuid, boolean)
  from public, anon;
grant execute on function public.set_expense_paid_status(uuid, uuid, boolean)
  to authenticated;

commit;
