// src/pages/calendar-order-scheduling/components/CartDetailsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';
import cartDbService from '../../../services/cartDBService';
import { formatCustomizations } from '../../../utils/cartFormat';

function groupItemsByPerson(items = []) {
  const groups = new Map();

  const push = (name, row, { shared = false } = {}) => {
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push({ ...row, __shared: shared });
  };

  for (const it of items) {
    const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
    const qty = Number(it?.quantity ?? 1);
    const lines = formatCustomizations(it);
    const base = {
      id: it?.id,
      name: it?.name || 'Item',
      qty,
      unit,
      lines,
      image: it?.image || null,
      notes: it?.specialInstructions || '',
    };

    const names = Array.isArray(it?.assignedTo)
      ? it.assignedTo.map((a) => a?.name).filter(Boolean)
      : (it?.userName ? [it.userName] : []);

    if (names.length === 0) {
      push('Unassigned', base);
      continue;
    }

    // Split across people. If more than one, mark as shared.
    const shared = names.length > 1;
    for (const n of names) push(n, base, { shared });
  }

  // Bubble Extras to the bottom and keep alphabetical elsewhere
  const sorted = [...groups.entries()].sort(([a], [b]) => {
    const ax = a.toLowerCase() === 'extra';
    const bx = b.toLowerCase() === 'extra';
    if (ax && !bx) return 1;
    if (!ax && bx) return -1;
    return a.localeCompare(b);
  });

  return sorted; // [ [personName, items[]], ... ]
}

export default function CartDetailsModal({ isOpen, onClose, cartId }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [snap, setSnap] = useState(null);
  const panelRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Load snapshot when opened
  useEffect(() => {
    let cancelled = false;
    if (!isOpen || !cartId) { setSnap(null); return; }
    (async () => {
      setLoading(true); setErr('');
      try {
        const s = await cartDbService.getCartSnapshot(cartId);
        if (!cancelled) setSnap(s);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load cart');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, cartId]);

  const byPerson = useMemo(
    () => (isOpen ? groupItemsByPerson(snap?.items || []) : []),
    [isOpen, snap?.items]
  );

  const grandSubtotal = useMemo(() => {
    if (!isOpen) return 0;
    return (snap?.items || []).reduce((s, it) => {
      const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
      const qty  = Number(it?.quantity ?? 1);
      return s + unit * qty;
    }, 0);
  }, [isOpen, snap?.items]);

  if (!isOpen) return null;

  const dateStr = snap?.fulfillment?.date || snap?.cart?.fulfillment_date || null;
  const timeStr = snap?.fulfillment?.time || snap?.cart?.fulfillment_time || null;

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-athletic-lg"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="ShoppingCart" size={18} />
            <div className="min-w-0">
              <div className="font-semibold leading-5 truncate">
                {snap?.restaurant?.name || 'Draft Cart'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close cart details">
            <Icon name="X" size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}

          {!loading && !err && (
            <>
              {/* Grouped by person */}
              {byPerson.map(([person, items]) => {
                const subtotal = items.reduce((s, it) => s + it.unit * it.qty, 0);
                return (
                  <div key={person} className="border border-border rounded-md overflow-hidden">
                    <div className="px-3 py-2 bg-muted/60 flex items-center justify-between">
                      <div className="font-medium">{person}</div>
                      <div className="text-xs text-muted-foreground">
                        {/* Subtotal: <span className="text-foreground">${subtotal.toFixed(2)}</span> */}
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {items.map((it, idx) => (
                        <div key={`${it.id}-${idx}`} className="p-3 flex items-start gap-3">
                          {it.image && (
                            <img src={it.image} alt="" className="h-12 w-12 rounded object-cover shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground truncate">
                              {it.name}{' '}
                              {it.__shared && (
                                <span className="ml-1 text-[11px] px-1 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  shared
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">x{it.qty} • ${it.unit.toFixed(2)}</div>
                            {it.lines?.length > 0 && (
                              <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                {it.lines.map((l, i) => <li key={i}>{l}</li>)}
                              </ul>
                            )}
                            {it.notes && (
                              <div className="text-xs text-muted-foreground mt-1">
                                Notes: <span className="text-foreground">{it.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Overall */}
              <div className="pt-1 text-sm text-muted-foreground flex items-center justify-between">
                <span>Items: {(snap?.items || []).reduce((n, it) => n + Number(it?.quantity || 0), 0)}</span>
                <span>
                  Subtotal: <span className="text-foreground">${grandSubtotal.toFixed(2)}</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer (optional actions) */}
        <div className="p-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
