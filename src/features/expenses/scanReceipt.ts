import { supabase } from '../../lib/supabase';
import { parseReceiptScan, type ReceiptScan } from './receiptImport';

function isErrorBody(value: unknown): value is { error: string } {
  return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

export async function scanReceipt(groupId: string, imageBase64: string): Promise<ReceiptScan> {
  const { data, error } = await supabase.functions.invoke('scan-receipt', {
    body: { group_id: groupId, image_base64: imageBase64 },
  });

  if (error) {
    if (error.context instanceof Response) {
      const responseBody: unknown = await error.context.json().catch(() => null);
      if (isErrorBody(responseBody)) throw new Error(responseBody.error);
      if (error.context.status === 404) {
        throw new Error('Receipt scanning has not been enabled on this server yet.');
      }
      if (error.context.status === 401) {
        throw new Error('Sign in again to scan this bill.');
      }
    }
    throw new Error('Could not scan the bill. Check your connection and try again.');
  }

  return parseReceiptScan(data);
}
