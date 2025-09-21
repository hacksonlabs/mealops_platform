// src/utils/cartVisibility.js
export function itemBelongsToMember(it, memberId, identity) {
  if (!memberId) return false;

  // Strong signals
  if (it?.addedByMemberId && it.addedByMemberId === memberId) return true;
  if (Array.isArray(it?.assignedTo) && it.assignedTo.some(a => a?.id === memberId)) return true;

  // Soft fallbacks (best-effort)
  const email = (identity?.email || '').trim().toLowerCase();
  const full  = (identity?.fullName || '').trim().toLowerCase();

  if (email && Array.isArray(it?.assignedTo) && it.assignedTo.some(a => (a?.email || '').trim().toLowerCase() === email)) {
    return true;
  }
  if (full && Array.isArray(it?.assignedTo) && it.assignedTo.some(a => (a?.name || '').trim().toLowerCase() === full)) {
    return true;
  }

  return false;
}

export function filterItemsForViewer(items, memberId, identity, allowAll) {
  if (allowAll) return items || [];
  return (items || []).filter(it => itemBelongsToMember(it, memberId, identity));
}

export function buildBadgeFromItems(items, cartId, name) {
  const count = (items || []).reduce((n, it) => n + Number(it?.quantity || 0), 0);
  const total = (items || []).reduce((s, it) => {
    const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
    const qty  = Number(it?.quantity ?? 1);
    return s + unit * qty;
  }, 0);
  return { count, total, name: name || 'Cart', cartId };
}
