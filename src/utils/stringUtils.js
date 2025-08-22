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