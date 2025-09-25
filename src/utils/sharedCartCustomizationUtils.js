import { toTitleCase } from './stringUtils';


export const slug = (s = '') =>
  String(s).toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');

export function inferGroupMetaFromName(name) {
  const n = (name || '').toLowerCase();
  if (n === 'size' || n === 'sizes') {
    return { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' };
  }
  if (n === 'topping' || n === 'toppings') {
    return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
  }
  if (/(bun|bread|tortilla|base|protein|rice|sauce|dressing)/i.test(n)) {
    return { type: 'single', required: false, min: 0, max: 1, pricingMode: 'additive' };
  }
  return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
}

export function normalizeOptionGroups(item) {
  const groups = [];
  const pushGroup = (id, name, meta, list = []) => {
    const m = meta || inferGroupMetaFromName(name);
    groups.push({
      id: id || slug(name),
      name,
      type: m.type,
      required: !!m.required,
      min: m.min ?? (m.required ? 1 : 0),
      max: m.max ?? (m.type === 'single' ? 1 : Infinity),
      pricingMode: m.pricingMode || 'additive',
      options: (list || []).map((o, i) => ({
        id: o.id || slug(o.name || `opt-${i}`),
        name: o.name || `Option ${i + 1}`,
        description: o.description || '',
        price: Number(o.price || 0),
      })),
    });
  };

  if (Array.isArray(item?.sizes) && item.sizes.length) {
    pushGroup('size', 'Size', { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' }, item.sizes);
  }
  if (Array.isArray(item?.toppings) && item.toppings.length) {
    pushGroup('toppings', 'Toppings', { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' }, item.toppings);
  }

  const raw = item?.options;
  if (Array.isArray(raw)) {
    if (raw[0]?.options) {
      raw.forEach((g, i) => {
        const meta = g.type
          ? { type: g.type, required: !!g.required, min: g.min, max: g.max, pricingMode: g.pricingMode }
          : inferGroupMetaFromName(g.name);
        pushGroup(g.id || slug(g.name || `group-${i}`), g.name || `Options ${i + 1}`, meta, g.options);
      });
    } else {
      pushGroup('options', 'Options', { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' }, raw);
    }
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([groupName, arr], gi) => {
      if (!Array.isArray(arr)) return;
      if (/^sizes?$/.test(groupName) && item?.sizes?.length) return;
      if (/^toppings?$/.test(groupName) && item?.toppings?.length) return;
      const meta = inferGroupMetaFromName(groupName);
      pushGroup(slug(groupName || `group-${gi}`), groupName || `Options ${gi + 1}`, meta, arr);
    });
  }

  // absolute-priced groups (usually Size) first for pricing calc
  groups.sort((a, b) => (b.pricingMode === 'absolute') - (a.pricingMode === 'absolute'));
  return groups;
}

export function findOptionIdByAny(group, val) {
  const vId = typeof val === 'object' ? val?.id : undefined;
  const vName = typeof val === 'object' ? val?.name : (typeof val === 'string' ? val : undefined);

  const byId = vId && group.options.find((o) => o.id === vId);
  if (byId) return byId.id;

  const byName = vName && group.options.find(
    (o) => String(o.name || '').toLowerCase() === String(vName).toLowerCase()
  );
  if (byName) return byName.id;

  if (typeof val === 'string') {
    const direct = group.options.find((o) => o.id === val);
    if (direct) return direct.id;
  }
  return null;
}

export function extractMemberIdsFromPreset(assignedTo, members, EXTRA_SENTINEL) {
  if (!Array.isArray(assignedTo)) return [];
  const ids = [];
  assignedTo.forEach((a) => {
    if (typeof a === 'string') {
      const s = a.trim().toLowerCase();
      if (s === 'extra') { ids.push(EXTRA_SENTINEL); return; }
      const m = members.find((mm) => (mm.full_name || '').toLowerCase() === s);
      if (m) ids.push(m.id);
      return;
    }
    if (a && typeof a === 'object') {
      const nm = (a.name || a.full_name || '').trim().toLowerCase();
      if (nm === 'extra') { ids.push(EXTRA_SENTINEL); return; }
      if (a.id) { ids.push(a.id); return; }
      const m = members.find((mm) => (mm.full_name || '').toLowerCase() === nm);
      if (m) ids.push(m.id);
    }
  });
  return ids;
}

export function computeUnitPrice(itemPrice, groups, selections) {
  let base = Number(itemPrice || 0);
  let add = 0;
  for (const g of groups) {
    const chosen = selections[g.id] || [];
    if (g.pricingMode === 'absolute') {
      const id = chosen[0];
      const opt = g.options.find((o) => o.id === id);
      if (opt) base = Number(opt.price || base);
    } else {
      for (const id of chosen) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) add += Number(opt.price || 0);
      }
    }
  }
  return base + add;
}

export function optionsListFromMembers(members, EXTRA_SENTINEL) {
  const roleLabel = (role) => {
    const cleaned = String(role || '').trim();
    return cleaned ? toTitleCase(cleaned) : 'Other';
  };

  const extraOption = {
    value: EXTRA_SENTINEL,
    label: 'Extra',
    search: 'extra unassigned',
    roleGroup: 'Extras',
  };

  const memberOptions = (members || []).map((m) => {
    const name = m?.full_name || '';
    const email = m?.email || '';
    const roleGroup = roleLabel(m?.role);

    return {
      value: m?.id,
      label: name || email || 'Unnamed',
      search: `${name} ${email} ${roleGroup}`.trim().toLowerCase(),
      roleGroup,
    };
  });

  return [extraOption, ...memberOptions];
}
