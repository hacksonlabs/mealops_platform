// src/components/ui/cart/CartDetailsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Button from '../custom/Button';
import Icon from '../../AppIcon';
import cartDbService from '../../../services/cartDBService';
// NEW: pull in the status meta
import { STATUS_META } from '../../../utils/ordersUtils';
import { toTitleCase } from '@/utils/stringUtils';

export default function CartDetailsModal({ isOpen, onClose, cartId }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [snap, setSnap] = useState(null);
  const panelRef = useRef(null);

  // Close on Esc
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

  // Build per-person rows
  const tableRows = useMemo(() => {
    if (!isOpen) return [];
    const rows = [];
    for (const it of (snap?.items || [])) {
      const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
      const qty  = Number(it?.quantity ?? 1);
      const names = Array.isArray(it?.assignedTo)
        ? it.assignedTo.map(a => a?.name).filter(Boolean)
        : (it?.userName ? [it.userName] : []);
      const perPerson = (unit * qty) / Math.max(names.length || 1, 1);
      const assignees = names.length ? names : ['Unassigned'];
      const special = (toTitleCase(it?.specialInstructions) || '').trim();

      for (const person of assignees) {
        rows.push({
          person,
          itemName: it?.name || 'Item',
          special,
          cost: perPerson
        });
      }
    }
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

  // ---- formatting helpers ----
  const fmtDateShort = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };
  const fmtTime = (timeStr) => {
    if (!timeStr) return '—';
    const [hh = '12', mm = '00'] = String(timeStr).split(':');
    const d = new Date();
    d.setHours(Number(hh) || 0, Number(mm) || 0, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const serviceRaw = snap?.cart?.fulfillment_service || '—';
  const service = typeof serviceRaw === 'string'
    ? serviceRaw.charAt(0).toUpperCase() + serviceRaw.slice(1)
    : '—';

  const isDelivery = String(serviceRaw).toLowerCase() === 'delivery';
  const address = snap?.cart?.fulfillment_address || '';
  const dateStr = snap?.cart?.fulfillment_date || null;
  const timeStr = snap?.cart?.fulfillment_time || null;

  const itemCount = (snap?.items || []).reduce((n, it) => n + Number(it?.quantity || 0), 0);
  const itemsLabel = `${itemCount} item${itemCount === 1 ? '' : 's'} · $${grandSubtotal.toFixed(2)}`;
  const dateTimeLabel = `${fmtDateShort(dateStr)} • ${fmtTime(timeStr)}`;

  // status chip from STATUS_META
  const statusKey = String(snap?.cart?.status || 'draft').toLowerCase();
  const statusMeta = STATUS_META[statusKey] || STATUS_META.draft;
  const statusLabel = statusMeta.labelShort || statusMeta.label || (statusKey.charAt(0).toUpperCase() + statusKey.slice(1));

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/40 p-4 sm:p-6 md:p-8 flex items-start sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cart details"
        className="w-full max-w-[880px] bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border">
          {/* Top line: icon • status • Title */}
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-2 flex-1">
              <Icon name="ShoppingCart" size={18} />

              {/* STATUS CHIP */}
              <span
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ring-1',
                  statusMeta.bg, statusMeta.text, statusMeta.ring, 'border-transparent'
                ].join(' ')}
                title={statusLabel}
              >
                <span>{statusLabel}</span>
              </span>

              <h2 className="text-lg md:text-xl font-heading font-semibold text-foreground truncate">
                {snap?.cart?.title?.trim() || snap?.restaurant?.name || 'Draft Cart'}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <Icon name="X" size={18} />
            </Button>
          </div>

          {/* Sub line: restaurant name */}
          <p className="mt-1 text-xs md:text-sm text-muted-foreground truncate">
            {snap?.restaurant?.name || '—'}
          </p>

          {/* Meta line: Service • Items/Total • Date/Time */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted/40">
              <Icon name={isDelivery ? 'Truck' : 'Store'} size={14} className="text-muted-foreground" />
              <span className="font-medium">{service}</span>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted/40 tabular-nums">
              <Icon name="Package" size={14} className="text-muted-foreground" />
              <span className="font-medium">{itemsLabel}</span>
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted/40">
              <Icon name="Calendar" size={14} className="text-muted-foreground" />
              <span className="font-medium">{dateTimeLabel}</span>
            </span>
          </div>

          {/* Address (only for delivery) */}
          {isDelivery && (
            <div className="mt-2 flex items-start gap-2 p-2.5 rounded-md border border-border bg-muted/30">
              <Icon name="MapPin" size={16} className="mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide">Delivery Address</div>
                <div className="text-sm font-medium break-words">{address || '—'}</div>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-4 md:p-5 flex-1 overflow-auto overscroll-contain">
          {loading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {err && <div className="text-sm text-destructive">{err}</div>}

          {!loading && !err && (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[13px] md:text-sm border-collapse">
                <thead className="sticky top-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
                  <tr className="border-b border-border">
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Team member
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Item
                    </th>
                    <th className="hidden md:table-cell text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Special requests
                    </th>
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Cost
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r, i) => (
                    <tr key={i} className={`border-b border-border ${i % 2 ? 'bg-muted/20' : ''}`}>
                      <td className="py-2.5 px-3 whitespace-nowrap text-foreground">{r.person}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-foreground font-medium">{r.itemName}</span>
                      </td>
                      <td className="hidden md:table-cell py-2.5 px-3">
                        {r.special ? (
                          <div className="text-muted-foreground">{r.special}</div>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-foreground">
                        ${r.cost.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-card">
                  <tr>
                    <td colSpan={3} className="py-2.5 px-3 text-right text-muted-foreground">Subtotal</td>
                    <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                      ${grandSubtotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 md:p-4 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
