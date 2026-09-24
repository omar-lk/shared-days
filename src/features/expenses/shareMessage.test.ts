/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { GroupMember } from '../groups/queries';
import type { ExpenseDetail } from './queries';
import { formatExpenseShareMessage } from './shareMessage';

test('formats the 1,199 MAD dinner with item allocations and amounts owed', () => {
  const members: GroupMember[] = [
    { id: 'omar', display_name: 'Omar', user_id: 'user-omar', role: 'owner' },
    { id: 'ahmed', display_name: 'Ahmed', user_id: null, role: 'member' },
    { id: 'jack', display_name: 'Jack', user_id: null, role: 'member' },
    { id: 'fayrouz', display_name: 'Fayrouz', user_id: null, role: 'member' },
  ];
  const detail: ExpenseDetail = {
    expense: {
      id: 'expense', group_id: 'group', payer_member_id: 'omar',
      total_minor: 119900, created_at: '2026-09-16T00:00:00Z',
    },
    items: [
      { id: 'pizza', description: 'Pizza', price_minor: 10000, split_method: 'equal', position: 0 },
      { id: 'ahmed-tagine', description: 'Ahmed tagine', price_minor: 30000, split_method: 'equal', position: 1 },
      { id: 'jack-tagine', description: 'Jack tagine', price_minor: 30000, split_method: 'equal', position: 2 },
      { id: 'salad', description: 'Salad', price_minor: 9900, split_method: 'equal', position: 3 },
      { id: 'wine', description: 'Wine', price_minor: 40000, split_method: 'equal', position: 4 },
    ],
    allocations: [
      { item_id: 'pizza', member_id: 'omar', amount_minor: 10000 },
      { item_id: 'ahmed-tagine', member_id: 'ahmed', amount_minor: 30000 },
      { item_id: 'jack-tagine', member_id: 'jack', amount_minor: 30000 },
      { item_id: 'salad', member_id: 'fayrouz', amount_minor: 9900 },
      { item_id: 'wine', member_id: 'omar', amount_minor: 10000 },
      { item_id: 'wine', member_id: 'ahmed', amount_minor: 10000 },
      { item_id: 'wine', member_id: 'jack', amount_minor: 10000 },
      { item_id: 'wine', member_id: 'fayrouz', amount_minor: 10000 },
    ],
  };

  const message = formatExpenseShareMessage({ groupName: 'Dinner', currency: 'MAD', members, detail });
  assert.match(message, /\*Dinner expense\*\nTotal: 1,199\.00 MAD\nPaid by: Omar/);
  assert.match(message, /• Pizza — 100\.00 MAD\n  Omar: 100\.00 MAD/);
  assert.match(message, /• Wine — 400\.00 MAD/);
  assert.match(message, /• Omar: 200\.00 MAD \(payer's share\)/);
  assert.match(message, /• Ahmed owes Omar: 400\.00 MAD/);
  assert.match(message, /• Jack owes Omar: 400\.00 MAD/);
  assert.match(message, /• Fayrouz owes Omar: 199\.00 MAD/);
  assert.match(message, /Paid status is not included\./);

  const withPaidStatus = formatExpenseShareMessage({
    groupName: 'Dinner', currency: 'MAD', members, detail,
    paidMemberIds: ['ahmed'],
  });
  assert.match(withPaidStatus, /• Ahmed: 400\.00 MAD \(marked paid\)/);
  assert.match(withPaidStatus, /• Jack owes Omar: 400\.00 MAD/);
});
