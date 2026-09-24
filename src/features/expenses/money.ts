export function parseMinorUnits(text: string): number | null {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (!match) return null;

  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  const amount = whole * 100 + fraction;
  return Number.isSafeInteger(amount) ? amount : null;
}

export function formatMinorUnits(amount: number | bigint): string {
  const minor = typeof amount === 'bigint' ? amount : BigInt(amount);
  const absolute = minor < 0n ? -minor : minor;
  const whole = (absolute / 100n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % 100n).toString().padStart(2, '0');
  return `${minor < 0n ? '-' : ''}${whole}.${fraction}`;
}
