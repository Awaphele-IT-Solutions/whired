// Dates are handled as local calendar days ("YYYY-MM-DD"), never as instants,
// so an interview on the 14th stays on the 14th in every timezone.

const pad = (n) => String(n).padStart(2, '0');

export function toDayKey(date) {
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
}

export function parseDayKey(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Reject rollovers such as 2026-02-31.
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function daysBetween(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function formatShortDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
