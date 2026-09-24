-- Review against the live groups/group_members schema and RLS before applying.
-- This migration adds itemized expenses only; repayments remain separate.
begin;

do $$
declare
  v_table text;
  v_column text;
begin
  if to_regclass('public.groups') is null or to_regclass('public.group_members') is null then
    raise exception 'Expected public.groups and public.group_members before itemized expenses';
  end if;

  foreach v_table in array array['groups', 'group_members'] loop
    foreach v_column in array array['id'] loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = v_table
          and column_name = v_column and udt_name = 'uuid'
      ) then
        raise exception 'Expected public.%.% to be uuid', v_table, v_column;
      end if;
    end loop;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'group_members'
      and column_name = 'group_id' and udt_name = 'uuid'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'group_members'
      and column_name = 'user_id' and udt_name = 'uuid'
  ) then
    raise exception 'Expected group_members.group_id and user_id to be uuid';
  end if;
end;
$$;

-- Needed for composite foreign keys that keep every member in one group.
create unique index group_members_group_id_id_expense_uidx
  on public.group_members (group_id, id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  payer_member_id uuid not null,
  total_minor bigint not null check (total_minor > 0 and total_minor <= 9007199254740991),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (id, group_id),
  foreign key (group_id, payer_member_id)
    references public.group_members (group_id, id)
);

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null,
  group_id uuid not null,
  position integer not null check (position >= 0),
  description text not null check (length(btrim(description)) > 0),
  price_minor bigint not null check (price_minor > 0 and price_minor <= 9007199254740991),
  split_method text not null check (split_method in ('equal', 'custom')),
  unique (expense_id, position),
  unique (id, group_id),
  foreign key (expense_id, group_id)
    references public.expenses (id, group_id) on delete cascade
);

create table public.item_allocations (
  item_id uuid not null,
  group_id uuid not null,
  member_id uuid not null,
  amount_minor bigint not null check (amount_minor >= 0 and amount_minor <= 9007199254740991),
  primary key (item_id, member_id),
  foreign key (item_id, group_id)
    references public.expense_items (id, group_id) on delete cascade,
  foreign key (group_id, member_id)
    references public.group_members (group_id, id)
);

create index expenses_group_id_idx on public.expenses (group_id);
create index expense_items_expense_id_idx on public.expense_items (expense_id);
create index item_allocations_member_id_idx on public.item_allocations (member_id);

alter table public.expenses enable row level security;
alter table public.expense_items enable row level security;
alter table public.item_allocations enable row level security;

create policy expenses_read_group_member on public.expenses
  for select to authenticated
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = expenses.group_id and gm.user_id = (select auth.uid())
  ));

create policy expense_items_read_group_member on public.expense_items
  for select to authenticated
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = expense_items.group_id and gm.user_id = (select auth.uid())
  ));

create policy item_allocations_read_group_member on public.item_allocations
  for select to authenticated
  using (exists (
    select 1 from public.group_members gm
    where gm.group_id = item_allocations.group_id and gm.user_id = (select auth.uid())
  ));

revoke all on public.expenses, public.expense_items, public.item_allocations
  from public, anon, authenticated;
grant select on public.expenses, public.expense_items, public.item_allocations
  to authenticated;

-- Payload: [{"description":"Wine","price_minor":40000,"split_method":"equal",
--            "participant_member_ids":["member-uuid", ...]},
--           {"description":"Tagine","price_minor":30000,"split_method":"custom",
--            "participant_member_ids":["member-uuid", ...],
--            "allocations":[{"member_id":"member-uuid","amount_minor":20000}, ...]}]
-- The function validates the entire payload before any insert. A raised exception
-- rolls back the function statement, so no partial expense is persisted.
create function public.create_itemized_expense(
  p_group_id uuid,
  p_payer_member_id uuid,
  p_items jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_participant jsonb;
  v_allocation jsonb;
  v_normalized_items jsonb := '[]'::jsonb;
  v_normalized_allocations jsonb;
  v_participants uuid[];
  v_seen_allocations uuid[];
  v_member_id uuid;
  v_price bigint;
  v_amount bigint;
  v_total numeric := 0;
  v_allocated numeric;
  v_description text;
  v_split_method text;
  v_expense_id uuid;
  v_item_id uuid;
  v_position integer := 0;
  v_index integer;
  v_count integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = (select auth.uid())
  ) then
    raise exception 'Caller must be a linked member of this group';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.id = p_payer_member_id
  ) then
    raise exception 'Payer must belong to this group';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Expense must contain at least one item';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Each item must be an object';
    end if;
    v_description := btrim(v_item->>'description');
    if v_description is null or v_description = '' then
      raise exception 'Each item needs a description';
    end if;
    if jsonb_typeof(v_item->'price_minor') is distinct from 'number'
      or (v_item->>'price_minor') is null
      or (v_item->>'price_minor') !~ '^[0-9]+$' then
      raise exception 'Item price must be integer minor units';
    end if;
    v_price := (v_item->>'price_minor')::bigint;
    if v_price <= 0 or v_price > 9007199254740991 then
      raise exception 'Item price is outside the supported range';
    end if;
    v_total := v_total + v_price;
    if v_total > 9007199254740991 then
      raise exception 'Expense total exceeds safe integer minor units';
    end if;

    v_split_method := v_item->>'split_method';
    if v_split_method is null or v_split_method not in ('equal', 'custom') then
      raise exception 'Item split method must be equal or custom';
    end if;
    if jsonb_typeof(v_item->'participant_member_ids') is distinct from 'array' then
      raise exception 'Each item needs participants';
    end if;
    if jsonb_array_length(v_item->'participant_member_ids') = 0 then
      raise exception 'Each item needs participants';
    end if;

    v_participants := array[]::uuid[];
    for v_participant in
      select value from jsonb_array_elements(v_item->'participant_member_ids')
    loop
      if jsonb_typeof(v_participant) <> 'string' then
        raise exception 'Participant IDs must be UUID strings';
      end if;
      v_member_id := (v_participant #>> '{}')::uuid;
      if array_position(v_participants, v_member_id) is not null then
        raise exception 'Duplicate item participant';
      end if;
      if not exists (
        select 1 from public.group_members gm
        where gm.group_id = p_group_id and gm.id = v_member_id
      ) then
        raise exception 'Item participant must belong to this group';
      end if;
      v_participants := array_append(v_participants, v_member_id);
    end loop;
    select array_agg(member_id order by member_id::text collate "C")
      into v_participants from unnest(v_participants) as ids(member_id);

    v_normalized_allocations := '[]'::jsonb;
    v_allocated := 0;
    v_count := cardinality(v_participants);
    if v_split_method = 'equal' then
      if v_item ? 'allocations' then
        raise exception 'Equal split items must not provide custom allocations';
      end if;
      for v_index in 1..v_count loop
        v_amount := v_price / v_count + case
          when v_index <= (v_price % v_count) then 1 else 0 end;
        v_normalized_allocations := v_normalized_allocations || jsonb_build_array(
          jsonb_build_object('member_id', v_participants[v_index], 'amount_minor', v_amount)
        );
        v_allocated := v_allocated + v_amount;
      end loop;
    else
      if jsonb_typeof(v_item->'allocations') is distinct from 'array' then
        raise exception 'Custom split needs one allocation per participant';
      end if;
      if jsonb_array_length(v_item->'allocations') <> v_count then
        raise exception 'Custom split needs one allocation per participant';
      end if;
      v_seen_allocations := array[]::uuid[];
      for v_allocation in select value from jsonb_array_elements(v_item->'allocations') loop
        if jsonb_typeof(v_allocation) <> 'object'
          or jsonb_typeof(v_allocation->'member_id') is distinct from 'string'
          or jsonb_typeof(v_allocation->'amount_minor') is distinct from 'number'
          or (v_allocation->>'amount_minor') is null
          or (v_allocation->>'amount_minor') !~ '^[0-9]+$' then
          raise exception 'Custom allocation needs member_id and integer amount_minor';
        end if;
        v_member_id := (v_allocation->>'member_id')::uuid;
        if array_position(v_participants, v_member_id) is null
          or array_position(v_seen_allocations, v_member_id) is not null then
          raise exception 'Custom allocation has duplicate or nonparticipant member';
        end if;
        v_seen_allocations := array_append(v_seen_allocations, v_member_id);
        v_amount := (v_allocation->>'amount_minor')::bigint;
        if v_amount < 0 or v_amount > 9007199254740991 then
          raise exception 'Allocation is outside the supported range';
        end if;
        v_allocated := v_allocated + v_amount;
        v_normalized_allocations := v_normalized_allocations || jsonb_build_array(
          jsonb_build_object('member_id', v_member_id, 'amount_minor', v_amount)
        );
      end loop;
    end if;

    if v_allocated <> v_price then
      raise exception 'Item allocations must exactly equal item price';
    end if;
    v_normalized_items := v_normalized_items || jsonb_build_array(jsonb_build_object(
      'description', v_description,
      'price_minor', v_price,
      'split_method', v_split_method,
      'allocations', v_normalized_allocations
    ));
  end loop;

  insert into public.expenses (group_id, payer_member_id, total_minor, created_by)
  values (p_group_id, p_payer_member_id, v_total::bigint, (select auth.uid()))
  returning id into v_expense_id;

  for v_item in select value from jsonb_array_elements(v_normalized_items) loop
    insert into public.expense_items
      (expense_id, group_id, position, description, price_minor, split_method)
    values
      (v_expense_id, p_group_id, v_position, v_item->>'description',
       (v_item->>'price_minor')::bigint, v_item->>'split_method')
    returning id into v_item_id;

    for v_allocation in select value from jsonb_array_elements(v_item->'allocations') loop
      insert into public.item_allocations (item_id, group_id, member_id, amount_minor)
      values (v_item_id, p_group_id, (v_allocation->>'member_id')::uuid,
              (v_allocation->>'amount_minor')::bigint);
    end loop;
    v_position := v_position + 1;
  end loop;

  return v_expense_id;
end;
$$;

revoke all on function public.create_itemized_expense(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_itemized_expense(uuid, uuid, jsonb) to authenticated;

commit;
