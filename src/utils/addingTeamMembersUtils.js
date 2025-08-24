import { toTitleCase, normalizePhoneNumber, normalizeBirthday } from './stringUtils';

// ---- Canonical schema for members CSV ----
export const CANONICAL_ORDER = ['name', 'email', 'phoneNumber', 'role', 'allergies', 'birthday'];

export const MEMBER_ROLES_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'coach',  label: 'Coach'  },
  { value: 'staff',  label: 'Staff'  },
];

export const ROLE_CONFIG = {
  coach: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Coach' },
  player: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Player' },
  staff: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Staff' }
};

export const HEADER_ALIASES = {
  'name': 'name',
	'Name': 'name',
	'email': 'email',
	'Email': 'email',
	'Phone Number': 'phoneNumber',
	'phone #': 'phoneNumber',
	'Phone #': 'phoneNumber',
	'phone number': 'phoneNumber',
	'phone_number': 'phoneNumber',
	'phone': 'phoneNumber',
	'role': 'role',
	'Role': 'role',
	'allergies': 'allergies',
	'Allergies': 'allergies',
	'birthday': 'birthday',
	'Birthday': 'birthday',
	'bday': 'birthday',
	'Bday': 'birthday',
};

export const prettyLabelFor = (k) => ({
  name: 'Name',
  email: 'Email',
  phoneNumber: 'Phone Number',
  role: 'Role',
  allergies: 'Allergies',
  birthday: 'Birthday',
}[k] || k);

// ---- Helpers ----
export const slug = (s) =>
  String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-_]/g, '');

export const splitCsvLine = (line) => {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur.trim()); cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
};

const normalizeHeader = (h) => HEADER_ALIASES[String(h || '').trim().toLowerCase()] || String(h || '').trim().toLowerCase();

export const normalizeMember = (m = {}) => {
  const roleLower = String(m.role || 'player').toLowerCase();
  return {
    name: toTitleCase(m.name || ''),
    email: String(m.email || '').trim().toLowerCase(),
    phoneNumber: normalizePhoneNumber(m.phoneNumber || ''),
    role: ['player', 'coach', 'staff'].includes(roleLower) ? roleLower : 'player',
    allergies: toTitleCase(m.allergies || ''),
    birthday: normalizeBirthday(m.birthday || ''), // -> yyyy-MM-dd or ''
  };
};

// --- Dedupe helpers (email-based) ---

// Build a stable key (email only; change here if you later want phone fallback)
export const dedupKeyFor = (m) => {
  const email = String(m?.email || '').trim().toLowerCase();
  return email ? `e:${email}` : null;
};

// Finds duplicates *within* a list. Returns groups like:
// [ [{idx, m}, {idx, m}], [{idx, m}, {idx, m}, {idx, m}] ]
export const findIntraListDuplicates = (arr, keyFn = dedupKeyFor) => {
  const map = new Map();
  const groups = [];
  arr.forEach((m, idx) => {
    const key = keyFn(m);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ idx, m });
  });
  for (const [, list] of map) {
    if (list.length > 1) groups.push(list);
  }
  return groups;
};

// Pretty message for banners
export const duplicatesMessage = (groups) => {
  if (!groups?.length) return '';
  const lines = groups.map(g => `• ${g.map(({ m }) => m.email).join(', ')}`);
  return `You have duplicate emails. Please remove 1.${groups.length > 1 ? ' groups' : ''}\n${lines.join('\n')}`;
};

// ---- Parse CSV -> { rows, errors[], warnings[] } ----
export const parseMembersCsv = (csvText, { existingMembers = [], currentUser = null } = {}) => {
  const errors = [];
  const warnings = [];

  try {
    let text = String(csvText || '').replace(/^\uFEFF/, ''); // strip BOM
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim() !== '');
    if (lines.length <= 1) {
      errors.push('CSV file is empty or contains only headers.');
      return { rows: [], errors, warnings };
    }

    // headers
    const headerMeta = splitCsvLine(lines[0])
      .map((raw, idx) => ({ raw: String(raw || '').trim(), canon: normalizeHeader(raw), idx }))
      .filter(h => h.raw.length > 0 && h.canon.length > 0);

    const headers = headerMeta.map(h => h.canon);

    // required
    const required = ['name', 'email', 'phoneNumber'];
    const missing = required.filter(k => !headers.includes(k));
    if (missing.length) {
      errors.push(`CSV is missing required headers: ${missing.map(prettyLabelFor).join(', ')}.`);
      return { rows: [], errors, warnings };
    }

    // unknown headers
    const allowed = new Set(CANONICAL_ORDER);
    const unknownOriginal = headerMeta.filter(h => !allowed.has(h.canon)).map(h => h.raw);
    if (unknownOriginal.length) {
      warnings.push(
        `Unrecognized header${unknownOriginal.length > 1 ? 's' : ''}: ${unknownOriginal.join(', ')}. ` +
        `Allowed headers are: ${CANONICAL_ORDER.map(prettyLabelFor).join(', ')}.`
      );
    }

    // normalize existing emails (for dedupe against team)
    const existingEmailsLower = new Set(
      (existingMembers || [])
        .map(x => {
          // support shapes: {email}, {m: {email}}, raw string, etc.
          if (typeof x === 'string') return x.toLowerCase();
          if (x?.email) return String(x.email).toLowerCase();
          if (x?.m?.email) return String(x.m.email).toLowerCase();
          return '';
        })
        .filter(Boolean)
    );

    const rows = [];
    const csvSeen = new Set();
    const alreadyOnTeam = new Set();
    const csvDupes = new Set();

    lines.slice(1).forEach((line) => {
      const values = splitCsvLine(line);
      if (values.every(v => v === '')) return;

      const raw = {};
      headerMeta.forEach(({ canon, idx }) => { raw[canon] = values[idx] ?? ''; });

      const member = normalizeMember(raw);

      if (!member.name || !member.email || !member.phoneNumber) {
        // silently skip bad rows (or push to warnings if you prefer)
        return;
      }

      const emailLower = member.email.toLowerCase();

      if (existingEmailsLower.has(emailLower)) {
        alreadyOnTeam.add(emailLower);
        return;
      }

      if (csvSeen.has(emailLower)) {
        csvDupes.add(emailLower);
        return;
      }

      csvSeen.add(emailLower);
      rows.push(member);
    });

    if (currentUser?.email) {
      const idx = rows.findIndex(r => r.email.toLowerCase() === currentUser.email.toLowerCase());
      if (idx !== -1) rows[idx].role = 'coach';
    }

    if (!rows.length && !errors.length) {
      errors.push('CSV file does not contain any valid member data rows.');
    }

    if (alreadyOnTeam.size) {
      warnings.push(
        `${alreadyOnTeam.size} entr${alreadyOnTeam.size > 1 ? 'ies are' : 'y is'} already on your team ` +
        `(${[...alreadyOnTeam].join(', ')}). They were skipped.`
      );
    }
    if (csvDupes.size) {
      warnings.push(
        `Ignored ${csvDupes.size} duplicate entr${csvDupes.size > 1 ? 'ies' : 'y'} in the CSV ` +
        `(${[...csvDupes].join(', ')}).`
      );
    }

    return { rows, errors, warnings };
  } catch (e) {
    console.error('parseMembersCsv failed:', e);
    errors.push('Failed to parse CSV file. Please check the format and try again.');
    return { rows: [], errors, warnings };
  }
};

// ---- Export helpers (CSV) ----

// Convert your DB rows -> export rows
export const membersToExportRows = (teamMembers = []) =>
  teamMembers.map((m) => ({
    name: m.full_name || m.name || '',
    email: m.email || '',
    role: m.role || '',
    phoneNumber: m.phone_number || m.phoneNumber || '',
    allergies: m.allergies || '',
  }));

export const EXPORT_COLUMNS = [
  { key: 'name',       label: 'Name' },
  { key: 'email',      label: 'Email' },
  { key: 'role',       label: 'Role' },
  { key: 'phoneNumber',label: 'Phone' },
  { key: 'allergies',  label: 'Allergies' },
];

export const rowsToCsv = ({ columns = EXPORT_COLUMNS, rows = [] }) => {
  const header = columns.map(c => c.label);
  const body = rows.map(r => columns.map(c => r[c.key] ?? ''));
  const escape = (s) => {
    const str = String(s ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [header, ...body].map(row => row.map(escape).join(',')).join('\n');
};

export const downloadCsv = ({ rows, columns = EXPORT_COLUMNS, filename = 'export.csv' }) => {
  const csv = rowsToCsv({ columns, rows });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildMembersFilename = (teamInfo, { selectedCount = null, totalCount = null, date = new Date(), ext = 'csv' } = {}) => {
  const d = date.toISOString().split('T')[0];
  const pieces = [slug(teamInfo?.name) || 'team', slug(teamInfo?.sport), slug(teamInfo?.gender)].filter(Boolean).join('_');
  let scope = "";
  if (selectedCount != null) {
    scope = `-selected-${selectedCount}`;
  }
  return `${pieces || 'team'}-members-${d}${scope}.${ext}`;
};