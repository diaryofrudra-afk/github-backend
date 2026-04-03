export function safeLoad<T>(key: string, defaultValue: T): T {
  try {
    const v = localStorage.getItem(key);
    if (!v) return defaultValue;
    const p = JSON.parse(v);
    if (Array.isArray(defaultValue) && !Array.isArray(p)) return defaultValue;
    return p ?? defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveKey(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const cleanPhone = (v: unknown): string =>
  String(v || '').replace(/[^0-9]/g, '');

export const esc = (s: unknown): string =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const fmtINR = (n: number): string =>
  isNaN(n) ? '—' : '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function fmt12(t: string): string {
  if (!t) return '—';
  const [hh, mm] = t.split(':').map(Number);
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh < 12 ? 'AM' : 'PM'}`;
}

export function calcHours(s: string, e: string): number | null {
  if (!s || !e) return null;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let m = (eh * 60 + em) - (sh * 60 + sm);
  if (m <= 0) m += 24 * 60;
  return m <= 0 || m > 24 * 60 ? null : m / 60;
}

export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined || isNaN(h)) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
}

export function todayStr(): string {
  return todayISO();
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Format an ISO date string (YYYY-MM-DD) as dd/mm/yyyy */
export function fmtDate(d: string | undefined): string {
  if (!d) return '—';
  // Already dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return d;
  // ISO: YYYY-MM-DD
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Old format like "29 Mar 2026" — parse and convert
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, '0');
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${parsed.getFullYear()}`;
  }
  return d;
}

/** Normalize any date string to ISO (YYYY-MM-DD) format */
export function toISO(d: string): string {
  if (!d) return d;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  // dd/mm/yyyy
  const slashMatch = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  // Old "29 Mar 2026" style
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return d;
}

export function getExpiryStatus(d: string | undefined): { l: string; c: string } {
  if (!d) return { l: 'Not Set', c: 'none' };
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return { l: 'Expired', c: 'expired' };
  if (diff <= 30) return { l: `${diff}d left`, c: 'warn' };
  return { l: new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), c: 'ok' };
}

export interface BillResult {
  total: number; subtotal: number; sgst: number; cgst: number;
  gst: number; standard: number; ot: number; stdH: number;
  otH: number; rate: number; otRate: number; hasOT: boolean;
}

export function calcBill(
  h: number,
  crane: { rate: number; dailyLimit?: number; otRate?: number } | null,
  acc?: number
): BillResult | null {
  if (!crane || !h || h <= 0) return null;
  const rate = Number(crane.rate) || 0;
  const limit = Number(crane.dailyLimit) || 8;
  const otRate = Number(crane.otRate) > 0 ? Number(crane.otRate) : rate;
  if (!rate) return null;
  const a = acc || 0;
  let std = 0, ot = 0;
  if (a >= limit) ot = h;
  else { const r = limit - a; std = Math.min(h, r); ot = Math.max(0, h - r); }
  const subtotal = std * rate + ot * otRate;
  const sgst = Math.round(subtotal * 0.09 * 100) / 100;
  const cgst = Math.round(subtotal * 0.09 * 100) / 100;
  const total = subtotal + sgst + cgst;
  return { total, subtotal, sgst, cgst, gst: sgst + cgst, standard: std * rate, ot: ot * otRate, stdH: std, otH: ot, rate, otRate, hasOT: ot > 0 };
}
