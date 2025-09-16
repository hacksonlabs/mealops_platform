// src/utils/calendarUtils.js
export function getRangeForView(currentDate, viewMode) {
  const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
  start.setHours(0, 0, 0, 0);
  if (viewMode === 'twoWeeks') {
    const dow = start.getDay();
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const mStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const mEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: mStart, end: mEnd };
}
// export const fmtTime = (iso) => {
//   const d = new Date(iso);
//   const hours = String(d.getHours()).padStart(2, '0');
//   const minutes = String(d.getMinutes()).padStart(2, '0');
//   return `${hours}:${minutes}`;
// };
export const fmtTime = (iso) => {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12; // 0 -> 12
  return `${h}:${m} ${ampm}`;
};
export function mkBirthdayDateForYear(birthdayISO, year) {
  const b = new Date(birthdayISO);
  const m = b.getUTCMonth();
  const d = b.getUTCDate();
  const candidate = new Date(year, m, d);
  // Correct for months that don't have this day (e.g., Feb 29 in a non-leap year)
  if (candidate.getMonth() !== m) {
    return new Date(year, m, d - 1);
  }
  return candidate;
}
export function computeAge(onDateISO, dobISO) {
  const d = new Date(onDateISO);
  const dob = new Date(dobISO);
  let age = d.getFullYear() - dob.getFullYear();
  const m = d.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < dob.getDate())) age--;
  return age;
}
export function toE164US(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('+')) return trimmed;
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return null;
}