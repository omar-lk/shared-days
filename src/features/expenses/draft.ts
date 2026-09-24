import { calculateExpense, type ExpenseCalculation, type ExpenseItemInput } from './calculateExpense';
import { parseMinorUnits } from './money';

export type EditableExpenseItem = {
  id: string;
  description: string;
  priceText: string;
  participantMemberIds: string[];
  splitKind: 'equal' | 'custom';
  customShares: Record<string, string>;
};

export type ExpenseRpcItem = {
  description: string;
  price_minor: number;
  participant_member_ids: string[];
} & (
  | { split_method: 'equal' }
  | { split_method: 'custom'; allocations: { member_id: string; amount_minor: number }[] }
);

export function buildExpenseDraft(input: {
  payerMemberId: string;
  memberIds: readonly string[];
  items: readonly EditableExpenseItem[];
}): { calculation: ExpenseCalculation; rpcItems: ExpenseRpcItem[] } {
  const calculationItems: ExpenseItemInput[] = [];
  const rpcItems: ExpenseRpcItem[] = [];

  for (const [index, item] of input.items.entries()) {
    const description = item.description.trim();
    const priceMinor = parseMinorUnits(item.priceText);
    if (!description) throw new Error(`Item ${index + 1} needs a name`);
    if (priceMinor === null || priceMinor <= 0) {
      throw new Error(`Item ${index + 1} needs a valid amount with at most two decimals`);
    }
    if (item.participantMemberIds.length === 0) {
      throw new Error(`Item ${index + 1} needs at least one participant`);
    }

    if (item.splitKind === 'equal') {
      calculationItems.push({
        id: item.id,
        priceMinor,
        participantMemberIds: item.participantMemberIds,
        split: { kind: 'equal' },
      });
      rpcItems.push({
        description,
        price_minor: priceMinor,
        split_method: 'equal',
        participant_member_ids: item.participantMemberIds,
      });
    } else {
      const allocations = item.participantMemberIds.map((memberId) => {
        const amountMinor = parseMinorUnits(item.customShares[memberId] ?? '');
        if (amountMinor === null) {
          throw new Error(`Item ${index + 1} needs a valid custom share for every participant`);
        }
        return { memberId, amountMinor };
      });
      calculationItems.push({
        id: item.id,
        priceMinor,
        participantMemberIds: item.participantMemberIds,
        split: { kind: 'custom', allocations },
      });
      rpcItems.push({
        description,
        price_minor: priceMinor,
        split_method: 'custom',
        participant_member_ids: item.participantMemberIds,
        allocations: allocations.map(({ memberId, amountMinor }) => ({
          member_id: memberId,
          amount_minor: amountMinor,
        })),
      });
    }
  }

  return {
    calculation: calculateExpense({
      payerMemberId: input.payerMemberId,
      memberIds: input.memberIds,
      items: calculationItems,
    }),
    rpcItems,
  };
}
