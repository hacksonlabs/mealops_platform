// src/pages/checkout/components/OrderSummary.jsx
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import InfoTooltip from '../../../components/ui/InfoTooltip';

const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
const PROMO_STORAGE_KEY = 'mealops.checkout.appliedPromo';

const OrderSummary = ({
  subtotal,
  deliveryFee = 0,
  serviceFee = 0,
  tax,
  discount = 0,
  // `total` may be passed by parent, but we compute locally for live updates
  serviceType,
  onPromoCodeApply,
  tipAmount = 0,          // external tip (optional)
  onTipChange = () => {}, // notify parent, but don't rely on it for UI updates
}) => {
  /* ----------------------------- Promo state ----------------------------- */
  const [promoCode, setPromoCode] = useState('');                // input field
  const [appliedPromoCode, setAppliedPromoCode] = useState('');  // actually applied
  const [isPromoApplied, setIsPromoApplied] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [showPromo, setShowPromo] = useState(false);

  // Restore applied promo from storage (handles parent remounts)
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined'
        ? window.localStorage.getItem(PROMO_STORAGE_KEY)
        : null;
      if (saved) {
        setAppliedPromoCode(saved);
        setIsPromoApplied(true);
        // Optionally re-notify parent if no discount present yet (free shipping, etc.)
        // if (Number(discount || 0) === 0) onPromoCodeApply?.(saved);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  /* ------------------------------ Tip logic ----------------------------- */
  const percents = useMemo(() => [10, 15, 20], []);
  const pctToAmount = (p) => Number(((subtotal || 0) * p) / 100);
  const epsilon = 0.005;

  // Internal tip so totals update instantly
  // Default to 15% if no external tip is provided and subtotal is known at mount.
  const [localTip, setLocalTip] = useState(() => {
    const external = Number(tipAmount || 0);
    if (external > 0) return external;
    const s = Number(subtotal || 0);
    return Number(((s * 15) / 100).toFixed(2));
  });

  // Determine active mode from current tip
  const activeMode = useMemo(() => {
    for (const p of percents) if (Math.abs(localTip - pctToAmount(p)) < epsilon) return String(p);
    return 'other';
  }, [localTip, subtotal, percents]);

  const [mode, setMode] = useState(activeMode);
  useEffect(() => setMode(activeMode), [activeMode]);

  // Track if we already applied the 15% default for this mount
  const defaultAppliedRef = useRef(false);

  // Sync with parent IF it provides a non-zero tip; if it provides 0, only sync after default applied.
  useEffect(() => {
    const ext = Number(tipAmount || 0);
    if (ext > 0) {
      setLocalTip(ext);
    } else if (defaultAppliedRef.current) {
      setLocalTip(0);
    }
  }, [tipAmount]);

  // Apply default 15% once when subtotal first becomes available and no external tip is set.
  useEffect(() => {
    if (defaultAppliedRef.current) return;
    if (Number(tipAmount || 0) === 0 && Number(subtotal || 0) > 0) {
      const def = Number(((Number(subtotal) * 15) / 100).toFixed(2));
      setLocalTip(def);
      setMode('15');       // reflect selection in UI
      onTipChange(def);    // notify parent once
      defaultAppliedRef.current = true;
    }
  }, [subtotal, tipAmount, onTipChange]);

  // Custom tip input (kept independent while in "other" to avoid auto-fill while typing)
  const [customTipInput, setCustomTipInput] = useState(
    activeMode === 'other' ? '' : (localTip ? String(Number(localTip).toFixed(2)) : '')
  );

  // Only mirror localTip into the input when NOT in "other" mode (i.e., for % buttons)
  useEffect(() => {
    if (mode !== 'other') {
      setCustomTipInput(localTip ? String(Number(localTip).toFixed(2)) : '');
    }
  }, [localTip, mode]);

  // Recompute % tip if subtotal changes and a % mode is active
  useEffect(() => {
    const p = parseInt(mode, 10);
    if (!Number.isNaN(p) && percents.includes(p)) {
      const amt = Number(pctToAmount(p).toFixed(2));
      setLocalTip(amt);
      onTipChange(amt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]); // only when subtotal changes

  const selectPercent = (p) => {
    const amt = Number(pctToAmount(p).toFixed(2));
    setMode(String(p));
    setLocalTip(amt);
    onTipChange(amt);
    setCustomTipInput(amt.toFixed(2)); // safe because we’re not in "other"
  };

  const customRef = useRef(null);

  const selectOther = () => {
    setMode('other');
    setCustomTipInput('0'); // start at 0, no auto-fill while typing
    setLocalTip(0);
    onTipChange(0);
    setTimeout(() => customRef.current?.focus(), 0);
  };

  const handleCustomChange = (raw) => {
    const cleaned = raw.replace(/[^\d.]/g, '').replace(/^(\d*\.\d*).*$/, '$1');
    setCustomTipInput(cleaned);
    const n = parseFloat(cleaned);
    const amt = Number.isFinite(n) ? n : 0;
    setLocalTip(amt);
    onTipChange(amt);
  };

  const handleCustomBlur = () => {
    const n = parseFloat(customTipInput);
    setCustomTipInput(Number.isFinite(n) ? n.toFixed(2) : '0.00');
  };

  /* --------------------------- Promo handlers --------------------------- */
  const handleApplyPromo = () => {
    const raw = promoCode?.trim();
    if (!raw) { setPromoError('Please enter a promo code'); return; }
    const code = raw.toUpperCase();

    // Example validation (replace with server validation if you have it)
    const valid = ['SAVE10', 'WELCOME20', 'FREESHIP'];
    if (!valid.includes(code)) {
      setPromoError('Invalid promo code');
      return;
    }

    setIsPromoApplied(true);
    setAppliedPromoCode(code);       // show immediately
    setPromoError('');
    setShowPromo(false);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(PROMO_STORAGE_KEY, code);
      }
    } catch {}
    onPromoCodeApply?.(code);        // parent recomputes discount/totals (may remount us)
  };

  const handleRemovePromo = () => {
    setIsPromoApplied(false);
    setAppliedPromoCode('');
    setPromoCode('');
    setPromoError('');
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(PROMO_STORAGE_KEY);
      }
    } catch {}
    onPromoCodeApply?.('');          // clear on parent
  };

  /* --------------------------- Totals & flags --------------------------- */
  const hasDeliveryFee = serviceType === 'delivery' && Number(deliveryFee) > 0;
  const hasServiceFee  = Number(serviceFee) > 0;

  const showDiscountRow = isPromoApplied || Number(discount) > 0;
  const discountDisplay = Number(discount) > 0 ? `-${fmt(discount)}` : '—';

  // Always compute total locally so it reflects the *current* localTip
  const computedTotal = useMemo(() => {
    return (
      Number(subtotal || 0) +
      (hasDeliveryFee ? Number(deliveryFee) : 0) +
      (hasServiceFee ? Number(serviceFee) : 0) +
      Number(tax || 0) -
      Number(discount || 0) +
      Number(localTip || 0)
    );
  }, [subtotal, deliveryFee, serviceFee, tax, discount, localTip, hasDeliveryFee, hasServiceFee]);

  /* --------------------------------- UI -------------------------------- */
  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">Order Summary</h2>

      {/* Charges */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono">{fmt(subtotal)}</span>
        </div>

        {hasDeliveryFee && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span className="font-mono">{fmt(deliveryFee)}</span>
          </div>
        )}

        {hasServiceFee && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service Fee</span>
            <span className="font-mono">{fmt(serviceFee)}</span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground inline-flex items-center">
            <span>Estimated Tax</span>
            <InfoTooltip
              className="ml-1"
              side="top"
              text="Tax is estimated. Final amount will show on your receipt."
            />
          </span>
          <span className="font-mono">{fmt(tax)}</span>
        </div>

        {showDiscountRow && (
          <div className="flex justify-between text-sm text-success">
            <div className="flex items-center gap-2">
              <span>Discount</span>
            </div>
            <span className="font-mono">{discountDisplay}</span>
          </div>
        )}
      </div>

      {/* Tip */}
      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Tip</h3>
          <div className="text-right text-lg font-semibold tabular-nums">{fmt(localTip)}</div>
        </div>

        <div className="mt-3 inline-flex w-full rounded-full bg-muted p-1">
          {percents.map((p) => {
            const active = mode === String(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => selectPercent(p)}
                className={[
                  'flex-1 px-5 py-2 rounded-full text-sm font-semibold transition',
                  active
                    ? 'bg-primary text-background shadow'
                    : 'text-secondary/80 hover:text-secondary'
                ].join(' ')}
                aria-pressed={active}
                title={`${p}%`}
              >
                {p}%
              </button>
            );
          })}
          <button
            type="button"
            onClick={selectOther}
            className={[
              'flex-1 px-5 py-2 rounded-full text-sm font-semibold transition',
              mode === 'other'
                ? 'bg-primary text-background shadow'
                : 'text-secondary/80 hover:text-secondary'
            ].join(' ')}
            aria-pressed={mode === 'other'}
          >
            Other
          </button>
        </div>

        {mode === 'other' && (
          <div className="mt-3">
            <label className="block text-sm font-medium mb-1">Enter custom tip</label>
            <div className="relative w-32">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <input
                ref={customRef}
                type="text" // no up/down steppers
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={customTipInput}
                onChange={(e) => handleCustomChange(e.target.value)}
                onBlur={handleCustomBlur}
                className="w-full pl-5 pr-3 py-2 rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                placeholder="0.00"
                aria-label="Custom tip"
              />
            </div>
          </div>
        )}
      </div>

      {/* Total (live) */}
      <div className="mt-5 pt-5 border-t border-border">
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span className="font-mono text-lg">{fmt(computedTotal)}</span>
        </div>
      </div>

      {/* Promo Code (collapsible) */}
      {!isPromoApplied && (
        <div className="mt-4 pt-4 border-t border-border">
          {!showPromo ? (
            <button
              type="button"
              onClick={() => setShowPromo(true)}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <Icon name="Tag" size={14} />
              Add promo code
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Promo code</span>
                <button
                  type="button"
                  onClick={() => { setShowPromo(false); setPromoError(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Hide
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => { setPromoCode(e?.target?.value?.toUpperCase()); setPromoError(''); }}
                    error={promoError}
                  />
                </div>
                <Button variant="outline" onClick={handleApplyPromo} className="flex-shrink-0">
                  Apply
                </Button>
              </div>
              {promoError && (
                <div className="text-[12px] text-destructive mt-1">{promoError}</div>
              )}
            </div>
          )}
        </div>
      )}

      {isPromoApplied && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between p-3 bg-success/10 border border-success/20 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="Tag" size={16} className="text-success" />
              <span className="text-sm font-medium text-success">
                Promo code “{appliedPromoCode}” applied
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemovePromo}
              aria-label="Remove promo code"
              className="w-6 h-6 text-success hover:text-success/80"
              title="Remove promo"
            >
              <Icon name="X" size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderSummary;
