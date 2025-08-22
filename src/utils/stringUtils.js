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
  const parts = dateStr.split(/[\/-]/);
  if (parts.length === 3) {
    // Rearrange to YYYY-MM-DD
    const year = parts[2];
    const month = parts[0].padStart(2, '0');
    const day = parts[1].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return dateStr; // Return original if format is not as expected
}