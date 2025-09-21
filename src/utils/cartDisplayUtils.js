// src/utils/cartDisplayUtils.js

// ---- helpers to shape/expand cart items into per-unit rows ----

const isExtraName = (nm) => /^(extra|extras)$/i.test(String(nm || '').trim());

/** Friendly text for customizations (best-effort across shapes). */
export function extractCustomizations(it) {
  // 1) [{ name, price? }, ...]
  if (Array.isArray(it?.customizations) && it.customizations.length) {
    return it.customizations
      .map((c) => {
        const n = String(c?.name || '').trim();
        if (!n) return null;
        const p = Number(c?.price || 0);
        return p ? `${n} (+$${p.toFixed(2)})` : n;
      })
      .filter(Boolean)
      .join(', ');
  }

  // 2) fallback to selectedOptions/selected_options
  const so = it?.selectedOptions || it?.selected_options;
  if (so && typeof so === 'object') {
    const parts = [];
    const entries = Array.isArray(so) ? Array.from(so.entries?.() ?? []) : Object.entries(so);

    for (const [key, val] of entries) {
      if (key === '__assignment__') continue;

      if (typeof val === 'string') {
        parts.push(val);
      } else if (typeof val === 'number' || typeof val === 'boolean') {
        parts.push(`${key}: ${String(val)}`);
      } else if (Array.isArray(val)) {
        for (const v of val) {
          if (!v) continue;
          if (typeof v === 'string') parts.push(v);
          else if (typeof v === 'object') {
            const nm = v?.name || v?.label || v?.title;
            if (nm) {
              const p = Number(v?.price || v?.price_cents / 100 || 0);
              parts.push(p ? `${nm} (+$${p.toFixed(2)})` : nm);
            }
          }
        }
      } else if (typeof val === 'object') {
        const nm = val?.name || val?.label || val?.title;
        if (nm) {
          const p = Number(val?.price || val?.price_cents / 100 || 0);
          parts.push(p ? `${nm} (+$${p.toFixed(2)})` : nm);
        } else {
          const flat = Object.values(val || {})
            .map((x) => (typeof x === 'string' ? x : null))
            .filter(Boolean);
          if (flat.length) parts.push(...flat);
        }
      }
    }

    if (parts.length) return parts.join(', ');
  }

  return '';
}

/** Names from meta.display_names, with fallback to assignedTo[].name. */
export function getMemberNames(it) {
  const meta = it?.selectedOptions?.__assignment__ || it?.selected_options?.__assignment__ || {};
  let names = Array.isArray(meta.display_names) ? meta.display_names : null;

  if (!names || !names.length) {
    if (Array.isArray(it?.assignedTo) && it.assignedTo.length) {
      names = it.assignedTo.map((a) => String(a?.name || '').trim()).filter(Boolean);
    }
  }

  const out = [];
  const seen = new Set();
  for (const nmRaw of names || []) {
    const nm = String(nmRaw || '').trim();
    if (!nm || isExtraName(nm)) continue;
    if (seen.has(nm)) continue;
    seen.add(nm);
    out.push(nm);
  }
  return out;
}

/**
 * Plan units by name so that sum(members) + extras === quantity.
 * - start with 1 per member
 * - extras = meta.extra_count (or variants)
 * - balance remainder to last member (or extras if no members)
 */
export function planUnitsByName(quantity, memberNames = [], extrasCount = 0) {
  const qty = Math.max(1, Number(quantity || 1));
  const names = Array.from(memberNames);
  const units = {};
  let extras = Math.max(0, Number(extrasCount || 0));

  // default: 1 each
  for (const nm of names) units[nm] = (units[nm] || 0) + 1;

  let total = names.length + extras;
  let diff = qty - total;

  if (diff > 0) {
    if (names.length) {
      const last = names[names.length - 1];
      units[last] += diff;
    } else {
      extras += diff;
    }
  } else if (diff < 0) {
    let toRemove = -diff;
    const cut = Math.min(extras, toRemove);
    extras -= cut;
    toRemove -= cut;
    for (let i = names.length - 1; i >= 0 && toRemove > 0; i--) {
      const id = names[i];
      const take = Math.min(units[id], toRemove);
      units[id] -= take;
      toRemove -= take;
    }
  }

  for (const k of Object.keys(units)) if (units[k] <= 0) delete units[k];

  if (!names.length && extras === 0 && qty > 0) {
    return { unitsByName: { Unassigned: qty }, extras: 0 };
  }
  return { unitsByName: units, extras };
}

/** Compute unit price = base price + per-unit customization prices (if present). */
export function computeUnitPrice(it) {
  const base = Number(it?.customizedPrice ?? it?.price ?? 0);
  const add =
    (Array.isArray(it?.customizations) ? it.customizations : []).reduce(
      (s, c) => s + (Number(c?.price) || 0),
      0
    );
  return base + add;
}

/**
 * Expand each item to per-unit rows.
 * Returns rows: { assignee, itemName, customizations, special, unitPrice, sourceId, type }
 */
export function expandItemsToUnitRows(items = []) {
  const rows = [];
  for (const it of items) {
    const itemName = it?.name || 'Item';
    const customizations = extractCustomizations(it);
    const special = String(it?.specialInstructions || '').trim();
    const sourceId = it?.id || it?.menuItemId || it?.product_id || itemName;
    const unitPrice = computeUnitPrice(it);

    const meta = it?.selectedOptions?.__assignment__ || it?.selected_options?.__assignment__ || {};
    const extrasMeta =
      meta?.extra_count ??
      meta?.extras_count ??
      (Array.isArray(meta?.extras) ? meta.extras.length : 0) ??
      0;

    const memberNames = getMemberNames(it);
    const { unitsByName, extras } = planUnitsByName(it?.quantity, memberNames, extrasMeta);

    // members
    for (const nm of Object.keys(unitsByName)) {
      const count = unitsByName[nm];
      for (let i = 0; i < count; i++) {
        rows.push({
          assignee: nm,
          itemName,
          customizations,
          special,
          unitPrice,
          sourceId,
          type: 'member',
        });
      }
    }

    // extras
    for (let i = 0; i < extras; i++) {
      rows.push({
        assignee: 'Extra',
        itemName,
        customizations,
        special,
        unitPrice,
        sourceId,
        type: 'extra',
      });
    }
  }
  return rows;
}

/** Sort rows: normal names (A→Z), then Unassigned, then Extras. */
export function sortAssigneeRows(rows, collator = new Intl.Collator('en', { sensitivity: 'base' })) {
  const rank = (label) => {
    const s = String(label || '').toLowerCase();
    if (s === 'unassigned') return 1;
    if (s === 'extra') return 2;
    return 0;
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a.assignee);
    const rb = rank(b.assignee);
    if (ra !== rb) return ra - rb;
    return collator.compare(String(a.assignee), String(b.assignee));
  });
}

/** Add 1-based line numbers (useful for tables that need a # column). */
export function addLineNumbers(rows) {
  return rows.map((r, i) => ({ ...r, lineNo: i + 1 }));
}
