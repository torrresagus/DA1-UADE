/** 10000 → "10.000" — dot thousand separator, Argentine style */
export function fmtPrice(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Input formatter: strips non-digits and inserts dot separators. "10000" → "10.000" */
export function fmtMoneyInput(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
