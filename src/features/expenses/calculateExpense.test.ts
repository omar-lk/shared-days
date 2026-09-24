/// <reference types="node" />

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { calculateExpense, type ExpenseItemInput } from './calculateExpense';

const memberIds = ['omar', 'ahmed', 'jack', 'fayrouz'];

function equalItem(id: string, priceMinor: number, participantMemberIds: string[]): ExpenseItemInput {
  return { id, priceMinor, participantMemberIds, split: { kind: 'equal' } };
}

test('1,199 MAD restaurant bill keeps payer share and debts in centimes', () => {
  const result = calculateExpense({
    payerMemberId: 'omar',
    memberIds,
    items: [
      equalItem('pizza', 10000, ['omar']),
      equalItem('ahmed-tagine', 30000, ['ahmed']),
      equalItem('jack-tagine', 30000, ['jack']),
      equalItem('salad', 9900, ['fayrouz']),
      equalItem('wine', 40000, memberIds),
    ],
  });

  assert.equal(result.totalMinor, 119900);
  assert.deepEqual(result.shares, [
    { memberId: 'ahmed', amountMinor: 40000 },
    { memberId: 'fayrouz', amountMinor: 19900 },
    { memberId: 'jack', amountMinor: 40000 },
    { memberId: 'omar', amountMinor: 20000 },
  ]);
  assert.deepEqual(result.balances, [
    { memberId: 'ahmed', balanceMinor: -40000 },
    { memberId: 'fayrouz', balanceMinor: -19900 },
    { memberId: 'jack', balanceMinor: -40000 },
    { memberId: 'omar', balanceMinor: 99900 },
  ]);
});

test('one shared 300 MAD dish creates two 150 MAD allocations', () => {
  const result = calculateExpense({
    payerMemberId: 'omar',
    memberIds,
    items: [equalItem('tagine', 30000, ['jack', 'ahmed'])],
  });
  assert.deepEqual(result.itemAllocations, [
    { itemId: 'tagine', memberId: 'ahmed', amountMinor: 15000 },
    { itemId: 'tagine', memberId: 'jack', amountMinor: 15000 },
  ]);
});

test('custom 200/100 MAD split is retained exactly', () => {
  const result = calculateExpense({
    payerMemberId: 'omar',
    memberIds,
    items: [{
      id: 'tagine',
      priceMinor: 30000,
      participantMemberIds: ['jack', 'ahmed'],
      split: { kind: 'custom', allocations: [
        { memberId: 'jack', amountMinor: 10000 },
        { memberId: 'ahmed', amountMinor: 20000 },
      ] },
    }],
  });
  assert.deepEqual(result.itemAllocations, [
    { itemId: 'tagine', memberId: 'ahmed', amountMinor: 20000 },
    { itemId: 'tagine', memberId: 'jack', amountMinor: 10000 },
  ]);
});

test('equal split gives leftover centimes to IDs in sorted order', () => {
  const a = calculateExpense({
    payerMemberId: 'omar', memberIds,
    items: [equalItem('small', 101, ['jack', 'omar', 'ahmed'])],
  });
  const b = calculateExpense({
    payerMemberId: 'omar', memberIds,
    items: [equalItem('small', 101, ['ahmed', 'jack', 'omar'])],
  });
  assert.deepEqual(a.itemAllocations, b.itemAllocations);
  assert.deepEqual(a.itemAllocations, [
    { itemId: 'small', memberId: 'ahmed', amountMinor: 34 },
    { itemId: 'small', memberId: 'jack', amountMinor: 34 },
    { itemId: 'small', memberId: 'omar', amountMinor: 33 },
  ]);
});

test('rejects invalid currency values and allocations', () => {
  const base = {
    payerMemberId: 'omar', memberIds,
  };
  assert.throws(() => calculateExpense({ ...base, items: [equalItem('bad', 1.5, ['omar'])] }));
  assert.throws(() => calculateExpense({ ...base, items: [equalItem('bad', 0, ['omar'])] }));
  assert.throws(() => calculateExpense({ ...base, items: [{
    id: 'bad', priceMinor: 30000, participantMemberIds: ['ahmed', 'jack'],
    split: { kind: 'custom', allocations: [
      { memberId: 'ahmed', amountMinor: 20000 },
      { memberId: 'jack', amountMinor: 9000 },
    ] },
  }] }));
  assert.throws(() => calculateExpense({ ...base, items: [equalItem('too-big', Number.MAX_SAFE_INTEGER, ['omar']), equalItem('extra', 1, ['omar'])] }));
});

test('rejects duplicate and nonparticipant member IDs', () => {
  const base = { payerMemberId: 'omar', memberIds };
  assert.throws(() => calculateExpense({ ...base, items: [equalItem('bad', 100, ['omar', 'omar'])] }));
  assert.throws(() => calculateExpense({ ...base, items: [equalItem('bad', 100, ['outsider'])] }));
  assert.throws(() => calculateExpense({ ...base, payerMemberId: 'outsider', items: [equalItem('ok', 100, ['omar'])] }));
  assert.throws(() => calculateExpense({ ...base, items: [{
    id: 'bad', priceMinor: 100, participantMemberIds: ['omar'],
    split: { kind: 'custom', allocations: [{ memberId: 'jack', amountMinor: 100 }] },
  }] }));
  assert.throws(() => calculateExpense({ ...base, items: [{
    id: 'bad', priceMinor: 100, participantMemberIds: ['omar'],
    split: { kind: 'custom', allocations: [
      { memberId: 'omar', amountMinor: 50 },
      { memberId: 'omar', amountMinor: 50 },
    ] },
  }] }));
});
