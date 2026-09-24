/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildExpenseDraft, type EditableExpenseItem } from './draft';
import { formatMinorUnits, parseMinorUnits } from './money';

const members = ['omar', 'ahmed', 'jack', 'fayrouz'];

function item(id: string, description: string, priceText: string, participants: string[]): EditableExpenseItem {
  return {
    id,
    description,
    priceText,
    participantMemberIds: participants,
    splitKind: 'equal',
    customShares: {},
  };
}

test('parses decimal text into integer minor units without floating-point arithmetic', () => {
  assert.equal(parseMinorUnits('1,199.00'), null);
  assert.equal(parseMinorUnits('1199'), 119900);
  assert.equal(parseMinorUnits('99,5'), 9950);
  assert.equal(parseMinorUnits('0.01'), 1);
  assert.equal(parseMinorUnits('1.234'), null);
  assert.equal(formatMinorUnits(119900), '1,199.00');
  assert.equal(formatMinorUnits(9007199254740992n), '90,071,992,547,409.92');
});

test('builds the dinner RPC payload and shares from entered amounts', () => {
  const { calculation, rpcItems } = buildExpenseDraft({
    payerMemberId: 'omar',
    memberIds: members,
    items: [
      item('pizza', 'Pizza', '100', ['omar']),
      item('ahmed-tagine', 'Ahmed tagine', '300', ['ahmed']),
      item('jack-tagine', 'Jack tagine', '300', ['jack']),
      item('salad', 'Salad', '99', ['fayrouz']),
      item('wine', 'Wine', '400', members),
    ],
  });
  assert.equal(calculation.totalMinor, 119900);
  assert.equal(calculation.shares.find((share) => share.memberId === 'omar')?.amountMinor, 20000);
  assert.equal(calculation.shares.find((share) => share.memberId === 'ahmed')?.amountMinor, 40000);
  assert.equal(rpcItems[4].price_minor, 40000);
  assert.equal(rpcItems[4].split_method, 'equal');
});

test('builds custom allocations and rejects mismatched amounts', () => {
  const shared = item('tagine', 'Tagine', '300', ['ahmed', 'jack']);
  shared.splitKind = 'custom';
  shared.customShares = { ahmed: '200', jack: '100' };
  const draft = buildExpenseDraft({ payerMemberId: 'omar', memberIds: members, items: [shared] });
  assert.deepEqual(draft.rpcItems[0], {
    description: 'Tagine',
    price_minor: 30000,
    split_method: 'custom',
    participant_member_ids: ['ahmed', 'jack'],
    allocations: [
      { member_id: 'ahmed', amount_minor: 20000 },
      { member_id: 'jack', amount_minor: 10000 },
    ],
  });
  shared.customShares.jack = '90';
  assert.throws(() => buildExpenseDraft({ payerMemberId: 'omar', memberIds: members, items: [shared] }));
});
