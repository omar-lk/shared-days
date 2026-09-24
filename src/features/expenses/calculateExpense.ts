export type ItemAllocation = {
  memberId: string;
  amountMinor: number;
};

export type ExpenseItemInput = {
  id: string;
  priceMinor: number;
  participantMemberIds: readonly string[];
  split:
    | { kind: 'equal' }
    | { kind: 'custom'; allocations: readonly ItemAllocation[] };
};

export type ExpenseCalculation = {
  totalMinor: number;
  itemAllocations: { itemId: string; memberId: string; amountMinor: number }[];
  shares: ItemAllocation[];
  // Positive means the member should receive money; negative means they owe it.
  balances: { memberId: string; balanceMinor: number }[];
};

function requireMinorUnits(value: number, label: string, allowZero = false): void {
  if (!Number.isSafeInteger(value) || value < 0 || (!allowZero && value === 0)) {
    throw new Error(`${label} must be a ${allowZero ? 'nonnegative' : 'positive'} safe integer`);
  }
}

function addMinorUnits(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new Error('Expense total exceeds safe integer minor units');
  }
  return sum;
}

export function calculateExpense(input: {
  payerMemberId: string;
  memberIds: readonly string[];
  items: readonly ExpenseItemInput[];
}): ExpenseCalculation {
  const { payerMemberId, memberIds, items } = input;
  const groupMembers = new Set(memberIds);

  if (groupMembers.size !== memberIds.length || memberIds.some((id) => !id.trim())) {
    throw new Error('Group member IDs must be unique and nonempty');
  }
  if (!groupMembers.has(payerMemberId)) {
    throw new Error('Payer must be a group member');
  }
  if (items.length === 0) {
    throw new Error('Expense must contain at least one item');
  }

  const seenItems = new Set<string>();
  const shares = new Map<string, number>();
  const itemAllocations: ExpenseCalculation['itemAllocations'] = [];
  let totalMinor = 0;

  for (const item of items) {
    if (!item.id.trim() || seenItems.has(item.id)) {
      throw new Error('Item IDs must be unique and nonempty');
    }
    seenItems.add(item.id);
    requireMinorUnits(item.priceMinor, 'Item price');
    totalMinor = addMinorUnits(totalMinor, item.priceMinor);

    const participants = [...item.participantMemberIds].sort();
    if (
      participants.length === 0 ||
      new Set(participants).size !== participants.length ||
      participants.some((id) => !groupMembers.has(id))
    ) {
      throw new Error(`Item ${item.id} has duplicate or nonmember participants`);
    }

    let allocations: ItemAllocation[];
    if (item.split.kind === 'equal') {
      const base = Math.floor(item.priceMinor / participants.length);
      const remainder = item.priceMinor % participants.length;
      allocations = participants.map((memberId, index) => ({
        memberId,
        amountMinor: base + (index < remainder ? 1 : 0),
      }));
    } else {
      const custom = new Map<string, number>();
      for (const allocation of item.split.allocations) {
        if (!participants.includes(allocation.memberId) || custom.has(allocation.memberId)) {
          throw new Error(`Item ${item.id} has duplicate or nonparticipant allocations`);
        }
        requireMinorUnits(allocation.amountMinor, 'Allocation', true);
        custom.set(allocation.memberId, allocation.amountMinor);
      }
      if (custom.size !== participants.length) {
        throw new Error(`Item ${item.id} is missing participant allocations`);
      }
      allocations = participants.map((memberId) => {
        const amountMinor = custom.get(memberId);
        if (amountMinor === undefined) {
          throw new Error(`Item ${item.id} is missing participant allocations`);
        }
        return { memberId, amountMinor };
      });
    }

    const allocatedMinor = allocations.reduce(
      (sum, allocation) => addMinorUnits(sum, allocation.amountMinor),
      0
    );
    if (allocatedMinor !== item.priceMinor) {
      throw new Error(`Item ${item.id} allocations do not equal its price`);
    }

    for (const allocation of allocations) {
      shares.set(
        allocation.memberId,
        addMinorUnits(shares.get(allocation.memberId) ?? 0, allocation.amountMinor)
      );
      itemAllocations.push({ itemId: item.id, ...allocation });
    }
  }

  const memberShares = [...groupMembers].sort().map((memberId) => ({
    memberId,
    amountMinor: shares.get(memberId) ?? 0,
  }));
  const balances = memberShares.map(({ memberId, amountMinor }) => ({
    memberId,
    balanceMinor: memberId === payerMemberId ? totalMinor - amountMinor : -amountMinor,
  }));

  return { totalMinor, itemAllocations, shares: memberShares, balances };
}
