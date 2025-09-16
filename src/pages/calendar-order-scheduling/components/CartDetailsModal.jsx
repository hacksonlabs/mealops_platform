// src/pages/calendar-order-scheduling/components/CartDetailsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';
import cartDbService from '../../../services/cartDBService';
import { formatCustomizations } from '../../../utils/cartFormat';

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

	const tableRows = useMemo(() => {
		if (!isOpen) return [];
		const items = snap?.items || [];
		const rows = [];

		for (const it of items) {
			const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
			const qty  = Number(it?.quantity ?? 1);
			const lines = formatCustomizations(it);
			const names = Array.isArray(it?.assignedTo)
				? it.assignedTo.map(a => a?.name).filter(Boolean)
				: (it?.userName ? [it.userName] : []);

			const assignees = names.length ? names : ['Unassigned'];
			const shared = names.length > 1;
			const total = (unit * qty) / Math.max(names.length || 1, 1);

			for (const person of assignees) {
				rows.push({
					person,
					itemName: it?.name || 'Item',
					customizations: lines,
					cost: total,
					shared,
				});
			}
		}

		// Sort: A→Z, push "Extra" and "Unassigned" to the bottom
		return rows.sort((a, b) => {
			const ax = /^(extra|unassigned)$/i.test(a.person);
			const bx = /^(extra|unassigned)$/i.test(b.person);
			if (ax !== bx) return ax ? 1 : -1;
			return a.person.localeCompare(b.person);
		});
	}, [isOpen, snap?.items]);


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
        className="w-full max-w-4xl bg-card border border-border rounded-xl shadow-athletic-lg"
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
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}

          {!loading && !err && (
						<>
							<div className="overflow-x-auto">
								<table className="w-full text-sm border-collapse">
									<thead className="sticky top-0 bg-card">
										<tr className="border-b border-border">
											<th className="text-left py-2 px-3 font-medium text-muted-foreground">Team member</th>
											<th className="text-left py-2 px-3 font-medium text-muted-foreground">Item</th>
											<th className="text-left py-2 px-3 font-medium text-muted-foreground">Customizations</th>
											<th className="text-right py-2 px-3 font-medium text-muted-foreground">Cost</th>
										</tr>
									</thead>
									<tbody>
										{tableRows.map((r, i) => (
											<tr key={i} className="border-b border-border">
												<td className="py-2 px-3 whitespace-nowrap text-foreground">{r.person}</td>
												<td className="py-2 px-3">
													<div className="flex items-center gap-2">
														<span className="text-foreground font-medium">{r.itemName}</span>
													</div>
												</td>
												<td className="py-2 px-3">
													{r.customizations?.length ? (
														<div className="text-muted-foreground">
															{r.customizations.join(', ')}
														</div>
													) : (
														<span className="text-muted-foreground/70">—</span>
													)}
												</td>
												<td className="py-2 px-3 text-right tabular-nums text-foreground">
													${r.cost.toFixed(2)}
												</td>
											</tr>
										))}
									</tbody>
									{/* Footer subtotal */}
									<tfoot>
										<tr>
											<td colSpan={3} className="py-2 px-3 text-right text-muted-foreground">Subtotal</td>
											<td className="py-2 px-3 text-right font-semibold">
												${(snap?.items || []).reduce((s, it) => {
													const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
													const qty  = Number(it?.quantity ?? 1);
													return s + unit * qty;
												}, 0).toFixed(2)}
											</td>
										</tr>
									</tfoot>
								</table>
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
