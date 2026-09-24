import type { EditableExpenseItem } from './draft';
import { formatMinorUnits } from './money';

export type ReceiptLine = { description: string; priceMinor: number };
export type ReceiptScan = { items: ReceiptLine[]; totalMinor: number | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseReceiptScan(value: unknown): ReceiptScan {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length === 0 || value.items.length > 50) {
    throw new Error('The scan did not return a usable item list. Try another photo or enter the bill manually.');
  }

  const items: ReceiptLine[] = value.items.map((entry) => {
    if (!isRecord(entry) || typeof entry.description !== 'string' ||
      entry.description.trim().length === 0 || entry.description.trim().length > 100 ||
      typeof entry.price_minor !== 'number' || !Number.isSafeInteger(entry.price_minor) || entry.price_minor <= 0) {
      throw new Error('The scan contains an invalid item. Try another photo or enter the bill manually.');
    }
    return { description: entry.description.trim(), priceMinor: entry.price_minor };
  });

  const totalMinor = value.total_minor;
  if (totalMinor !== null &&
    (typeof totalMinor !== 'number' || !Number.isSafeInteger(totalMinor) || totalMinor <= 0)) {
    throw new Error('The scan returned an invalid receipt total. Try another photo or enter the bill manually.');
  }

  return { items, totalMinor };
}

export function editableItemsFromReceipt(scan: ReceiptScan, idPrefix: string): EditableExpenseItem[] {
  return scan.items.map((item, index) => ({
    id: `${idPrefix}-${index + 1}`,
    description: item.description,
    priceText: formatMinorUnits(item.priceMinor).replaceAll(',', ''),
    participantMemberIds: [],
    splitKind: 'equal',
    customShares: {},
  }));
}
