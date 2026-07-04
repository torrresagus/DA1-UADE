/** 10000 → "10.000" — dot thousand separator, Argentine style */
export function fmtPrice(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Parse a UTC datetime string from the backend into a local Date.
 * The backend returns naive UTC strings ("2026-07-05 18:34:51") with no timezone
 * marker. Without normalization, JS Date treats them as local time on some engines,
 * giving a 3-hour offset error for GMT-3.
 */
export function parseUtcDate(iso: string): Date {
  const normalized =
    iso.includes('Z') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z';
  return new Date(normalized);
}

/** Input formatter: strips non-digits and inserts dot separators. "10000" → "10.000" */
export function fmtMoneyInput(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
