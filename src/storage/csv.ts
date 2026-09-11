import type { Row, Cell } from './types';

/** A string cell that a spreadsheet would evaluate as a formula (=, +, -, @, tab, CR) gets a leading apostrophe,
 * the conventional neutraliser. Numbers are left alone, so negative values survive; ids and user-agent strings never
 * legitimately start with these characters. */
function neutralise(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function cell(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'string' ? neutralise(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Row[]): string {
  const cols: string[] = [];
  for (const r of rows) for (const k of Object.keys(r)) if (!cols.includes(k)) cols.push(k);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c] ?? null)).join(','))].join('\n') + '\n';
}
