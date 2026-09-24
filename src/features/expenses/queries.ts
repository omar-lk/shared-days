import { supabase } from '../../lib/supabase';
import type { ExpenseRpcItem } from './draft';

export type GroupExpense = {
  id: string;
  group_id: string;
  payer_member_id: string;
  total_minor: number;
  created_at: string;
};

export type ExpenseItem = {
  id: string;
  description: string;
  price_minor: number;
  split_method: 'equal' | 'custom';
  position: number;
};

export type ItemAllocation = {
  item_id: string;
  member_id: string;
  amount_minor: number;
};

export type ExpenseDetail = {
  expense: GroupExpense;
  items: ExpenseItem[];
  allocations: ItemAllocation[];
};

export type ExpenseSettlement = {
  member_id: string;
  amount_minor: number;
  marked_paid_at: string;
};

export type GroupExpenseSummary = { count: number; totalMinor: bigint };

export async function getGroupExpenseSummaries(): Promise<Map<string, GroupExpenseSummary>> {
  const summaries = new Map<string, GroupExpenseSummary>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('expenses')
      .select('group_id, total_minor')
      .order('id')
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    for (const expense of data ?? []) {
      const previous = summaries.get(expense.group_id) ?? { count: 0, totalMinor: 0n };
      summaries.set(expense.group_id, {
        count: previous.count + 1,
        totalMinor: previous.totalMinor + BigInt(expense.total_minor),
      });
    }
    if ((data?.length ?? 0) < pageSize) return summaries;
  }
}

export async function getGroupExpenses(groupId: string): Promise<GroupExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, group_id, payer_member_id, total_minor, created_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getExpenseDetail(groupId: string, expenseId: string): Promise<ExpenseDetail> {
  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .select('id, group_id, payer_member_id, total_minor, created_at')
    .eq('group_id', groupId)
    .eq('id', expenseId)
    .single();

  if (expenseError) throw expenseError;

  const { data: items, error: itemsError } = await supabase
    .from('expense_items')
    .select('id, description, price_minor, split_method, position')
    .eq('group_id', groupId)
    .eq('expense_id', expenseId)
    .order('position', { ascending: true });

  if (itemsError) throw itemsError;

  const itemIds = (items ?? []).map((item) => item.id);
  if (itemIds.length === 0) return { expense, items: [], allocations: [] };

  const { data: allocations, error: allocationsError } = await supabase
    .from('item_allocations')
    .select('item_id, member_id, amount_minor')
    .eq('group_id', groupId)
    .in('item_id', itemIds);

  if (allocationsError) throw allocationsError;
  return { expense, items: items ?? [], allocations: allocations ?? [] };
}

export async function getExpenseSettlements(
  groupId: string,
  expenseId: string
): Promise<ExpenseSettlement[]> {
  const { data, error } = await supabase
    .from('expense_settlements')
    .select('member_id, amount_minor, marked_paid_at')
    .eq('group_id', groupId)
    .eq('expense_id', expenseId);

  if (error) throw error;
  return data ?? [];
}

export async function setExpensePaidStatus(input: {
  expenseId: string;
  memberId: string;
  paid: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('set_expense_paid_status', {
    p_expense_id: input.expenseId,
    p_member_id: input.memberId,
    p_paid: input.paid,
  });
  if (error) throw error;
}

export async function createItemizedExpense(input: {
  groupId: string;
  payerMemberId: string;
  items: ExpenseRpcItem[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_itemized_expense', {
    p_group_id: input.groupId,
    p_payer_member_id: input.payerMemberId,
    p_items: input.items,
  });

  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Expense was saved without an ID');
  return data;
}

export async function updateItemizedExpense(input: {
  expenseId: string;
  payerMemberId: string;
  items: ExpenseRpcItem[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('update_itemized_expense', {
    p_expense_id: input.expenseId,
    p_payer_member_id: input.payerMemberId,
    p_items: input.items,
  });

  if (error) throw error;
  if (typeof data !== 'string') throw new Error('Expense was updated without an ID');
  return data;
}
