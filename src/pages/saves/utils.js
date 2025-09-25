export const toTitleCase = (value = '') =>
  value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

export const formatPhoneNumber = (value = '') => {
  const rawDigits = value.replace(/\D/g, '');
  if (!rawDigits) return '';

  const hasCountryCode = rawDigits.length > 10 && rawDigits.startsWith('1');
  const digits = hasCountryCode ? rawDigits.slice(1, 11) : rawDigits.slice(0, 10);

  if (!digits) return `+${rawDigits}`;
  if (digits.length < 4) return hasCountryCode ? `+1 ${digits}` : digits;
  if (digits.length < 7) {
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return hasCountryCode ? `+1 ${formatted}` : formatted;
  }
  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return hasCountryCode ? `+1 ${formatted}` : formatted;
};

export const buildContactSummary = (location) => {
  if (!location) return '';
  const parts = [];
  if (location.contact_name) parts.push(toTitleCase(location.contact_name));
  if (location.contact_phone) parts.push(formatPhoneNumber(location.contact_phone));
  if (location.contact_email) parts.push(location.contact_email);
  return parts.join(' | ');
};

export const addressKindOptions = [
  { value: 'main', label: 'Main Facility' },
  { value: 'practice', label: 'Practice Facility' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'other', label: 'Other' },
];

export const addressSideOptions = [
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'neutral', label: 'Neutral' },
];
