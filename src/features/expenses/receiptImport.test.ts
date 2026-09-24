import assert from 'node:assert/strict';
import test from 'node:test';

import { buildExpenseDraft } from './draft';
import { editableItemsFromReceipt, parseReceiptScan } from './receiptImport';

test('scanned prices become editable bill items without guessed participants', () => {
  const scan = parseReceiptScan({
    items: [
      { description: 'Pizza', price_minor: 10000 },
      { description: 'Wine', price_minor: 40000 },
    ],
    total_minor: 50000,
  });
  const items = editableItemsFromReceipt(scan, 'scan');

  assert.deepEqual(items.map((item) => [item.description, item.priceText]), [
    ['Pizza', '100.00'],
    ['Wine', '400.00'],
  ]);
  assert.deepEqual(items.map((item) => item.participantMemberIds), [[], []]);
  assert.equal(scan.totalMinor, 50000);
});

test('rejects missing, negative, and fractional minor-unit prices', () => {
  for (const price of [undefined, -1, 1.5]) {
    assert.throws(() => parseReceiptScan({
      items: [{ description: 'Pizza', price_minor: price }],
      total_minor: 100,
    }));
  }
});

test('rejects an empty or oversized scan and an invalid total', () => {
  assert.throws(() => parseReceiptScan({ items: [], total_minor: 100 }));
  assert.throws(() => parseReceiptScan({
    items: [{ description: 'Pizza', price_minor: 100 }],
    total_minor: '100',
  }));
  assert.throws(() => parseReceiptScan({
    items: Array.from({ length: 51 }, () => ({ description: 'Item', price_minor: 100 })),
    total_minor: null,
  }));
});

test('scanned dinner items can be assigned manually and saved through the existing draft engine', () => {
  const memberIds = ['omar', 'ahmed', 'jack', 'fayrouz'];
  const scan = parseReceiptScan({
    items: [
      { description: 'Pizza', price_minor: 10000 },
      { description: 'Tagine', price_minor: 30000 },
      { description: 'Tagine', price_minor: 30000 },
      { description: 'Salad', price_minor: 9900 },
      { description: 'Wine', price_minor: 40000 },
    ],
    total_minor: 119900,
  });
  const items = editableItemsFromReceipt(scan, 'dinner').map((item, index) => ({
    ...item,
    participantMemberIds: index === 4 ? memberIds : [memberIds[[0, 1, 2, 3][index]]],
  }));
  const draft = buildExpenseDraft({ payerMemberId: 'omar', memberIds, items });

  assert.equal(draft.calculation.totalMinor, 119900);
  assert.deepEqual(Object.fromEntries(draft.calculation.shares.map((share) => [share.memberId, share.amountMinor])), {
    omar: 20000,
    ahmed: 40000,
    jack: 40000,
    fayrouz: 19900,
  });
});
