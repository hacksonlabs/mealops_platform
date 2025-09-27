// src/utils/cartDisplayUtils.js

// ---- helpers to shape/expand cart items into per-unit rows ----

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
    const quantity = Math.max(1, Number(it?.quantity || 1));
    const isExtra = Boolean(it?.isExtra ?? it?.is_extra);
    const memberId = it?.memberId ?? it?.member_id ?? null;

    let assigneeLabel = 'Unassigned';
    if (isExtra) {
      assigneeLabel = 'Extra';
    } else if (Array.isArray(it?.assignedTo) && it.assignedTo.length) {
      assigneeLabel = it.assignedTo[0]?.name || 'Team member';
    } else if (memberId) {
      assigneeLabel = 'Team member';
    }

    const type = isExtra ? 'extra' : memberId ? 'member' : 'unassigned';

    for (let i = 0; i < quantity; i++) {
      rows.push({
        assignee: assigneeLabel,
        itemName,
        customizations,
        special,
        unitPrice,
        sourceId,
        type,
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
