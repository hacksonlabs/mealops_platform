// src/components/ui/cart/CartDetailsModal.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../custom/Button';
import Icon from '../../AppIcon';
import cartDbService from '../../../services/cartDBService';
import { STATUS_META } from '../../../utils/ordersUtils';
import { toTitleCase } from '@/utils/stringUtils';

// NEW: import the unit-expansion helpers
import {
  expandItemsToUnitRows,
  sortAssigneeRows,
} from '../../../utils/cartDisplayUtils';

export default function CartDetailsModal({ isOpen, onClose, cartId }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [snap, setSnap] = useState(null);
  const [deleting, setDeleting] = useState(false);
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

  // Expand to per-unit rows (then map to table rows)
  const unitRows = useMemo(
    () => (isOpen ? sortAssigneeRows(expandItemsToUnitRows(snap?.items || [])) : []),
    [isOpen, snap?.items]
  );

  const tableRows = useMemo(() => {
    return unitRows.map((r) => ({
      person: r.assignee,
      itemName: r.itemName,
      special: r.special,
      cost: Number(r.unitPrice || 0),
    }));
  }, [unitRows]);

  const grandSubtotal = useMemo(() => {
    return unitRows.reduce((s, r) => s + Number(r.unitPrice || 0), 0);
  }, [unitRows]);

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
  const restaurantAddress = snap?.restaurant?.address || '';
  const dateStr = snap?.cart?.fulfillment_date || null;
  const timeStr = snap?.cart?.fulfillment_time || null;

  // Use unit count so “2 of the same” shows as 2 rows
  const itemCount = unitRows.length;
  const itemsLabel = `${itemCount} item${itemCount === 1 ? '' : 's'} · $${grandSubtotal.toFixed(2)}`;
  const itemsCountText = `${itemCount} item${itemCount === 1 ? '' : 's'}`;
  const dateTimeLabel = `${fmtDateShort(dateStr)} • ${fmtTime(timeStr)}`;

  // status chip from STATUS_META
  const statusKey = String(snap?.cart?.status || 'draft').toLowerCase();
  const statusMeta = STATUS_META[statusKey] || STATUS_META.draft;
  const statusLabel = statusMeta.labelShort || statusMeta.label || (statusKey.charAt(0).toUpperCase() + statusKey.slice(1));

  const handleEdit = () => {
    const rid = snap?.restaurant?.id;
    if (!rid) return;
    const svc = (snap?.cart?.fulfillment_service || '').toString().toLowerCase();
    const fulfillmentState = {
      service: svc || 'delivery',
      address: snap?.cart?.fulfillment_address || '',
      coords:
        snap?.cart?.fulfillment_latitude != null && snap?.cart?.fulfillment_longitude != null
          ? { lat: snap.cart.fulfillment_latitude, lng: snap.cart.fulfillment_longitude }
          : null,
      date: snap?.cart?.fulfillment_date || null,
      time: (snap?.cart?.fulfillment_time || '').slice(0, 5) || null,
    };
    navigate(`/restaurant/${rid}`, {
      state: {
        cartId: snap?.cart?.id,
        restaurant: snap?.restaurant || null,
        fulfillment: fulfillmentState,
        provider: snap?.restaurant?.providerType || null,
        openCartOnLoad: true,
      },
    });
    onClose?.();
  };

  const handleDelete = async () => {
    const ok = window.confirm('Delete this cart and all its items? This cannot be undone.');
    if (!ok) return;
    try {
      setDeleting(true);
      await cartDbService.deleteCart(snap?.cart?.id);
      window.dispatchEvent?.(new CustomEvent('carts:refresh'));
      onClose?.();
    } catch (e) {
      alert(e?.message || 'Failed to delete cart.');
    } finally {
      setDeleting(false);
    }
  };

  const handleRefresh = async () => {
    try {
      const id = snap?.cart?.id || cartId;
      if (!id) return;
      const s = await cartDbService.getCartSnapshot(id);
      if (s) setSnap(s);
    } catch (e) {
      console.warn('Failed to refresh cart snapshot:', e?.message || e);
    }
  };

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
          {/* Header top row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Icon name="ShoppingCart" size={18} className="text-muted-foreground mt-0.5" />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h2 className="text-lg md:text-xl font-heading font-semibold text-foreground truncate">
                    {snap?.cart?.title?.trim() || 'Cart'}
                  </h2>
                  <span>-</span>
                  <div className="text-xs md:text-sm text-muted-foreground truncate mt-0.5">
                    {snap?.restaurant?.name|| '—'}
                  </div>
                  <span>-</span>
                  <span
                    className={[
                      'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] uppercase tracking-wide ring-1',
                      statusMeta.bg, statusMeta.text, statusMeta.ring, 'border-transparent'
                    ].join(' ')}
                    title={statusLabel}
                  >
                    <span>{statusLabel}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                aria-label="Refresh cart"
                title="Refresh cart"
              >
                <Icon name="RefreshCcw" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleEdit}
                aria-label="Edit cart"
                title="Edit (go to menu)"
              >
                <Icon name="Pencil" size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                disabled={deleting}
                aria-label="Delete cart"
                title="Delete cart"
                className="text-destructive"
              >
                <Icon name="Trash" size={16} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <Icon name="X" size={18} />
              </Button>
            </div>
          </div>

          {/* Compact meta row (no boxes) */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1">
              <Icon name={isDelivery ? 'Truck' : 'Store'} size={14} className="text-muted-foreground" />
              <span className="capitalize text-foreground">{service}</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Icon name="Package" size={14} className="text-muted-foreground" />
              <span className="text-foreground">{itemsCountText}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground">${grandSubtotal.toFixed(2)}</span>
            </span>
            <span className="text-muted-foreground">|</span>
            <span className="inline-flex items-center gap-1">
              <Icon name="Calendar" size={14} className="text-muted-foreground" />
              <span className="text-foreground">{dateTimeLabel}</span>
            </span>
          </div>

          {(isDelivery || String(serviceRaw).toLowerCase() === 'pickup') && (
            <div className="mt-2 flex items-start gap-2">
              <Icon name="MapPin" size={16} className="mt-0.5 text-muted-foreground" />
              <div className="min-w-0">
                {/* <div className="text-[11px] text-muted-foreground uppercase tracking-wide">
                  {isDelivery ? 'Delivery Address' : 'Pickup Address'}
                </div> */}
                <div className="text-sm break-words text-foreground">
                  {isDelivery ? (address || '—') : (restaurantAddress || '—')}
                </div>
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
                          <div className="text-muted-foreground">{toTitleCase(r.special)}</div>
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
        <div className="p-3 md:p-4 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {statusKey === 'abandoned' && 'This cart was not submitted before its scheduled time.'}
          </div>
          <div className="flex items-center gap-2" />
        </div>
      </div>
    </div>
  );
}
