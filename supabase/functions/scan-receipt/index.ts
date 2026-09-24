// Deno resolves npm: specifiers when Supabase deploys the Edge Function.
// eslint-disable-next-line import/no-unresolved
import { withSupabase } from 'npm:@supabase/server';

const MAX_BASE64_LENGTH = 7_000_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorResponse(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function outputText(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.output)) return null;
  for (const entry of value.output) {
    if (!isRecord(entry) || !Array.isArray(entry.content)) continue;
    for (const content of entry.content) {
      if (isRecord(content) && content.type === 'output_text' && typeof content.text === 'string') {
        return content.text;
      }
    }
  }
  return null;
}

function validScan(value: unknown): value is {
  items: { description: string; price_minor: number }[];
  total_minor: number | null;
} {
  if (!isRecord(value) || !Array.isArray(value.items) ||
    value.items.length === 0 || value.items.length > 50) return false;
  if (value.total_minor !== null &&
    (typeof value.total_minor !== 'number' || !Number.isSafeInteger(value.total_minor) || value.total_minor <= 0)) return false;
  let sum = 0;
  for (const item of value.items) {
    if (!isRecord(item) || typeof item.description !== 'string' ||
      item.description.trim().length === 0 || item.description.trim().length > 100 ||
      typeof item.price_minor !== 'number' || !Number.isSafeInteger(item.price_minor) || item.price_minor <= 0) return false;
    sum += item.price_minor;
    if (!Number.isSafeInteger(sum)) return false;
  }
  return true;
}

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return errorResponse('Use POST to scan a receipt.', 405);

    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BASE64_LENGTH + 1024) return errorResponse('This photo is too large. Try a smaller image.', 413);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid scan request.', 400);
    }
    if (!isRecord(body) || typeof body.group_id !== 'string' || !UUID_PATTERN.test(body.group_id) ||
      typeof body.image_base64 !== 'string' || body.image_base64.length === 0 ||
      body.image_base64.length > MAX_BASE64_LENGTH || body.image_base64.length % 4 !== 0 ||
      !body.image_base64.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image_base64)) {
      return errorResponse('Use a clear JPEG bill photo smaller than 5 MB.', 400);
    }

    const userId = ctx.userClaims?.id;
    if (!userId) return errorResponse('Sign in to scan a bill.', 401);

    const { data: membership, error: membershipError } = await ctx.supabase
      .from('group_members')
      .select('id')
      .eq('group_id', body.group_id)
      .eq('user_id', userId)
      .maybeSingle();
    if (membershipError) return errorResponse('Unable to check group access.', 503);
    if (!membership) return errorResponse('Only group members can scan bills for this group.', 403);

    const { data: group, error: groupError } = await ctx.supabase
      .from('groups')
      .select('currency')
      .eq('id', body.group_id)
      .single();
    if (groupError || !group) return errorResponse('Unable to read this group.', 503);

    const apiKey = Deno.env.get('OPENAI_API_KEY');
    if (!apiKey) return errorResponse('Receipt scanning is not configured on the server yet.', 503);

    let providerResponse: Response;
    try {
      providerResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4.1-mini',
          store: false,
          max_output_tokens: 3500,
          input: [{
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: `Extract the bill's purchasable lines in ${group.currency}. Return each distinct charged article with its full line price in integer minor units (two decimal places, for example 12.50 becomes 1250). Include positive taxes, service charges and tips as separate lines when charged in addition to article prices. For quantities, use the extended line price. Exclude headings, subtotals, totals, payment methods and duplicate lines. Account for discounts in article prices only when clear. Do not invent missing lines or amounts. total_minor is the final amount charged on the receipt, or null if unreadable. The user will review every line and assign people manually.`,
              },
              { type: 'input_image', image_url: `data:image/jpeg;base64,${body.image_base64}`, detail: 'high' },
            ],
          }],
          text: {
            format: {
              type: 'json_schema',
              name: 'receipt_lines',
              strict: true,
              schema: {
                type: 'object',
                properties: {
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        price_minor: { type: 'integer' },
                      },
                      required: ['description', 'price_minor'],
                      additionalProperties: false,
                    },
                  },
                  total_minor: { type: ['integer', 'null'] },
                },
                required: ['items', 'total_minor'],
                additionalProperties: false,
              },
            },
          },
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      return errorResponse('The scan service did not respond. Try again or enter the bill manually.', 503);
    }

    if (!providerResponse.ok) {
      return errorResponse('The scan service is unavailable. Try again later or enter the bill manually.', 503);
    }

    let providerBody: unknown;
    try {
      providerBody = await providerResponse.json();
      const text = outputText(providerBody);
      const scan: unknown = text ? JSON.parse(text) : null;
      if (!validScan(scan)) return errorResponse('Could not read the bill items. Try a clearer photo or enter them manually.', 422);
      return Response.json(scan);
    } catch {
      return errorResponse('Could not read the bill items. Try a clearer photo or enter them manually.', 422);
    }
  }),
};
