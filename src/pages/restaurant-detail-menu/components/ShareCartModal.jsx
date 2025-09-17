// src/components/ui/cart/ShareCartModal.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  cartTitle,
}) {
  const { activeTeam } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cartId, setCartId] = useState(inboundCartId || null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const lastSavedTitle = useRef("");

  // keep local cartId in sync with prop
  useEffect(() => setCartId(inboundCartId || null), [inboundCartId]);

  useEffect(() => {
    if (!isOpen) return;
    const seeded = (cartTitle || "Team Cart").trim();
    setTitle(seeded);
    lastSavedTitle.current = seeded;
    setErr("");
  }, [isOpen, cartTitle]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = useMemo(() => {
        if (!cartId) return "";
        // keep ?openCart=1 if you still want to auto-open the drawer
        return `${origin}/shared-cart/${encodeURIComponent(cartId)}?openCart=1`;
    }, [origin, cartId]);

  // Create a cart if needed; include fulfillment on INSERT to avoid a second write
  const handleCreateIfNeeded = async () => {
    if (cartId) return cartId;
    if (!activeTeam?.id || !restaurant?.id) throw new Error("Missing team or restaurant.");

    const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
    const newId = await cartDbService.ensureCartForRestaurant(
      activeTeam.id,
      restaurant.id,
      {
        title: safeTitle,
        providerType: providerType ?? null,
        providerRestaurantId: restaurant?.provider_restaurant_ids?.[providerType] || null,
        fulfillment: fulfillment || {},
      }
    );

    setCartId(newId);
    onCreated?.(newId);
    lastSavedTitle.current = safeTitle;
    return newId;
  };

  // Generate link (and persist title once if creating now)
  const handleGenerateLink = async () => {
    setErr("");
    try {
      setLoading(true);
      const id = await handleCreateIfNeeded();

      // If the user edited the title before generating, persist it once on create
      const safeTitle = (title?.trim() || restaurant?.name || "Team Cart");
      if (safeTitle !== lastSavedTitle.current) {
        await cartDbService.updateCartTitle(id, safeTitle);
        lastSavedTitle.current = safeTitle;
      }
    } catch (e) {
      setErr(e?.message || "Could not create the cart.");
    } finally {
      setLoading(false);
    }
  };

  // Auto-save title on blur when a cart already exists
  const handleTitleBlur = async () => {
    const next = (title || "").trim();
    if (!cartId || !next || next === lastSavedTitle.current) return;
    try {
      setLoading(true);
      await cartDbService.updateCartTitle(cartId, next);
      lastSavedTitle.current = next;
    } catch (e) {
      setErr(e?.message || "Failed to update title.");
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
              onBlur={handleTitleBlur}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 ring-primary/30"
              placeholder={cartTitle ? `${restaurant.name}` : "Team Cart"}
            />
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

        {/* Footer*/}
        <div className="p-3 md:p-4 flex items-center justify-end gap-2">
        </div>
      </div>
    </div>,
    document.body
  );
}
