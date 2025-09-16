// /src/utils/cartFormat.js
import { toTitleCase } from './stringUtils';

export const formatCustomizations = (item, { includeSpecial = false } = {}) => {
  if (!item) return [];

  const lines = [];

  // Legacy customizations
  if (Array.isArray(item.customizations) && item.customizations.length) {
    lines.push(...item.customizations.map((c) => c?.name ?? String(c)));
  }

  // Build option + group lookups
  const optionLookup = new Map();   // key -> { name, groupId }
  const groupNameById = new Map();  // groupId -> display name (Title Cased)
  const groupOrder = [];            // preserve UI order

  const addOption = (groupId, opt) => {
    if (!opt) return;
    const display = opt.name ?? opt.label ?? String(opt.id ?? opt.value ?? '');
    const keys = [opt.id, opt.value, opt.name, opt.label]
      .map((k) => (k == null ? null : String(k)))
      .filter(Boolean);
    for (const k of keys) optionLookup.set(k, { name: display, groupId });
  };

  const addGroup = (rawId, rawName) => {
    const gid = String(rawId ?? rawName ?? '');
    if (!groupNameById.has(gid)) {
      const pretty = toTitleCase(String(rawName ?? gid));
      groupNameById.set(gid, pretty);
      groupOrder.push(gid);
    }
    return gid;
  };

  const src = item.options;
  if (Array.isArray(src)) {
    for (const g of src) {
      const gid = addGroup(g?.id ?? g?.name ?? g?.label, g?.name ?? g?.label);
      const opts = Array.isArray(g?.options) ? g.options : [];
      for (const o of opts) addOption(gid, o);
    }
  } else if (src && typeof src === 'object') {
    for (const [gidRaw, arr] of Object.entries(src)) {
      const gid = addGroup(gidRaw, gidRaw);
      const opts = Array.isArray(arr) ? arr : [];
      for (const o of opts) addOption(gid, o);
    }
  }

  // Helpers
  const toKey = (v) =>
    typeof v === 'string' || typeof v === 'number'
      ? String(v)
      : v && (v.id ?? v.value ?? v.name ?? v.label) != null
      ? String(v.id ?? v.value ?? v.name ?? v.label)
      : null;

  const toDisplay = (v) => {
    const k = toKey(v);
    if (k != null && optionLookup.has(k)) return optionLookup.get(k).name;
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return v?.name ?? v?.label ?? (k != null ? k : null);
  };

  // Group selected options
  const so = item.selectedOptions;
  if (so) {
    const perGroup = new Map(); // groupId -> [labels...]
    const misc = [];

    const ensureGroup = (gid) => {
      const id = String(gid);
      if (!perGroup.has(id)) perGroup.set(id, []);
      return perGroup.get(id);
    };

    // internal / non-display keys to skip
    const SKIP_KEYS = new Set([
      '__assignment__',
      'special', 'special_request', 'special_requests',
      'note', 'notes',
      'specialInstructions', 'special_instructions',
    ]);

    if (Array.isArray(so)) {
      for (const v of so) {
        const k = toKey(v);
        const entry = k != null ? optionLookup.get(k) : null;
        const label = toDisplay(v);
        if (!label) continue;
        if (entry?.groupId) {
          const arr = ensureGroup(entry.groupId);
          if (!arr.includes(label)) arr.push(label);
        } else if (!misc.includes(label)) {
          misc.push(label);
        }
      }
    } else if (typeof so === 'object') {
      for (const [gidRaw, sel] of Object.entries(so)) {
        if (SKIP_KEYS.has(String(gidRaw))) continue;
        const gid = String(gidRaw);
        const values = Array.isArray(sel) ? sel : [sel];
        const arr = ensureGroup(gid);
        for (const v of values) {
          const label = toDisplay(v);
          if (label && !arr.includes(label)) arr.push(label);
        }
      }
    }

    // Emit "Category: a, b" in original order first
    for (const gid of groupOrder) {
      const arr = perGroup.get(gid);
      if (arr && arr.length) {
        const gname = groupNameById.get(gid) || toTitleCase(gid);
        lines.push(`${gname}: ${arr.join(', ')}`);
      }
    }
    // then any extra groups not in original order
    for (const [gid, arr] of perGroup.entries()) {
      if (!groupOrder.includes(gid) && arr.length) {
        const gname = groupNameById.get(gid) || toTitleCase(gid);
        lines.push(`${gname}: ${arr.join(', ')}`);
      }
    }
    // leftovers
    for (const m of misc) lines.push(m);
  }

  // Specials: only include when explicitly requested
  if (includeSpecial) {
    const special = (item.specialInstructions || '').trim();
    if (special) lines.push(`Special requests: ${toTitleCase(special)}`);
  }

  return lines.filter(Boolean);
};
