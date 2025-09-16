// src/components/ui/cart/ShareCartModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import Icon from "../../../components/AppIcon";
import Button from "../../../components/ui/custom/Button";
import cartDbService from "../../../services/cartDBService";
import { useAuth } from "../../../contexts";

export default function ShareCartModal({
  isOpen,
  onClose,
  cartId: inboundCartId,   // may be null
  restaurant,              // { id, name, provider_restaurant_ids? }
  providerType,            // e.g. 'grubhub'
  fulfillment,             // { service, address, coords, date, time }
  onCreated,               // (newCartId) => void
}) {
  const { activeTeam } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cartId, setCartId] = useState(inboundCartId || null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setCartId(inboundCartId || null), [inboundCartId]);

  // Seed/load title
  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return;
    setErr("");
    if (!cartId) {
      setTitle(restaurant?.name ? `${restaurant.name}` : "Team Cart");
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const snap = await cartDbService.getCartSnapshot(cartId);
        if (!cancelled) {
          const t = (snap?.cart?.title || snap?.restaurant?.name || "Team Cart").trim();
          setTitle(t);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || "Failed to load cart.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, cartId, restaurant?.name]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = useMemo(() => {
    if (!restaurant?.id || !cartId) return "";
    return `${origin}/restaurant/${restaurant.id}?cartId=${encodeURIComponent(cartId)}&openCart=1`;
  }, [origin, restaurant?.id, cartId]);

  // Create a cart if needed, set initial meta
  const handleCreateIfNeeded = async () => {
    if (cartId) return cartId;
    if (!activeTeam?.id || !restaurant?.id) throw new Error("Missing team or restaurant.");
    const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
    const newId = await cartDbService.ensureCartForRestaurant(activeTeam.id, restaurant.id, {
      title: safeTitle,
      providerType: providerType ?? null,
      providerRestaurantId: restaurant?.provider_restaurant_ids?.[providerType] || null,
    });
    await cartDbService.upsertCartFulfillment(newId, fulfillment || {}, {
      providerType: providerType ?? null,
      providerRestaurantId: restaurant?.provider_restaurant_ids?.[providerType] || null,
    });
    setCartId(newId);
    onCreated?.(newId);
    return newId;
  };

  const handleGenerateLink = async () => {
    setErr("");
    try {
      setLoading(true);
      const id = await handleCreateIfNeeded();
      const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
      await cartDbService.updateCartTitle(id, safeTitle);
    } catch (e) {
      setErr(e?.message || "Could not create the cart.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1400] bg-black/40 p-4 sm:p-6 md:p-8" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-lg bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Share Cart"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <Icon name="Share" size={18} />
            <span>Share Cart</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-5 space-y-4">
          {err && <div className="text-sm text-destructive">{err}</div>}

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Cart Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              placeholder={restaurant?.name ? `${restaurant.name}` : "Team Cart"}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Give your cart a clear name (e.g., “Tuesday Lunch – Design Team”).
            </p>
          </div>

          {/* One share link */}
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Share link</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                placeholder="Generate a shareable link →"
                className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground/90"
              />

              {/* Right-side action:
                  - No cart: "Generate Link"
                  - Has cart: Copy icon */}
              {!cartId ? (
                <Button
                  onClick={handleGenerateLink}
                  disabled={loading || !activeTeam?.id || !restaurant?.id}
                >
                  {loading ? "Generating…" : "Generate Link"}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Copy link"
                  aria-label="Copy link"
                  onClick={handleCopy}
                >
                  <Icon name={copied ? "Check" : "Copy"} size={16} />
                </Button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Make sure everyone you share this with is in your team members roster.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 md:p-4 flex items-center justify-between gap-2">
        </div>
      </div>
    </div>,
    document.body
  );
}
