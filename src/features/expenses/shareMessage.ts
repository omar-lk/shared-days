import type { GroupMember } from '../groups/queries';
import { formatMinorUnits } from './money';
import type { ExpenseDetail } from './queries';

export function formatExpenseShareMessage(input: {
  groupName: string;
  currency: string;
  members: readonly GroupMember[];
  detail: ExpenseDetail;
  paidMemberIds?: readonly string[];
}): string {
  const { groupName, currency, members, detail, paidMemberIds } = input;
  const paid = new Set(paidMemberIds);
  const names = new Map(members.map((member) => [member.id, member.display_name]));
  const memberName = (id: string) => names.get(id) ?? 'Group member';
  const payerId = detail.expense.payer_member_id;
  const payerName = memberName(payerId);
  const money = (minor: number) => `${formatMinorUnits(minor)} ${currency}`;

  const itemLines = detail.items.flatMap((item) => {
    const allocations = detail.allocations
      .filter((allocation) => allocation.item_id === item.id)
      .sort((left, right) => left.member_id.localeCompare(right.member_id));
    return [
      `• ${item.description} — ${money(item.price_minor)}`,
      ...allocations.map((allocation) =>
        `  ${memberName(allocation.member_id)}: ${money(allocation.amount_minor)}`
      ),
    ];
  });

  const shares = new Map<string, number>();
  for (const allocation of detail.allocations) {
    shares.set(allocation.member_id, (shares.get(allocation.member_id) ?? 0) + allocation.amount_minor);
  }
  const shareLines = [...shares.entries()]
    .filter(([, amount]) => amount > 0)
    .sort(([left], [right]) => {
      if (left === payerId) return -1;
      if (right === payerId) return 1;
      return memberName(left).localeCompare(memberName(right)) || left.localeCompare(right);
    })
    .map(([memberId, amount]) => memberId === payerId
      ? `• ${payerName}: ${money(amount)} (payer's share)`
      : paid.has(memberId)
        ? `• ${memberName(memberId)}: ${money(amount)} (marked paid)`
        : `• ${memberName(memberId)} owes ${payerName}: ${money(amount)}`
    );

  return [
    `*${groupName} expense*`,
    `Total: ${money(detail.expense.total_minor)}`,
    `Paid by: ${payerName}`,
    '',
    '*Items*',
    ...itemLines,
    '',
    '*Shares*',
    ...shareLines,
    '',
    paidMemberIds
      ? 'Paid markers are recorded by the group creator; partial repayments are not tracked.'
      : 'Paid status is not included.',
  ].join('\n');
}
