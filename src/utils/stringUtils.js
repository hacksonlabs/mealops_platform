// /src/utils/stringUtils.js

/**
 * Converts a string to title case.
 * @param {string} str The string to convert.
 * @returns {string} The title-cased string.
 */
export function toTitleCase(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Normalizes a phone number to (xxx) xxx-xxxx format.
 * @param {string} phone The phone number string to normalize.
 * @returns {string} The normalized phone number or the original string if it cannot be normalized.
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const cleaned = ('' + phone).replace(/\D/g, ''); // Remove all non-digit characters
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone; // Return original if not a 10-digit number
}

export function normalizeBirthday(dateStr) {
  if (!dateStr) return '';

  const s = String(dateStr).trim();

  // already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // YYYY/MM/DD or YYYY-M-D
  if (/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split(/[\/-]/);
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // MM/DD/YYYY or M-D-YYYY
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(s)) {
    const [m, d, y] = s.split(/[\/-]/);
    return `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Fallback: try to parse safely (use UTC to avoid TZ shifts)
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) {
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Unknown format -> empty string so the <input type="date"> stays valid
  return '';
}

/**
 * Formats a date string to MM/DD/YYYY.
 * @param {string} dateStr The date string to format.
 * @returns {string} The formatted date string (MM/DD/YYYY) or an empty string if invalid.
 */
export function formatDateToMMDDYYYY(dateStr) {
  if (!dateStr) {
    return '';
  }
  const date = new Date(dateStr); 
  if (isNaN(date.getTime())) {
    return '';
  }
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const year = date.getUTCFullYear();

  return `${month}/${day}/${year}`;
}