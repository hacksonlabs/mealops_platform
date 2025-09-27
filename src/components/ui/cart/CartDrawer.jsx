// src/components/ui/cart/CartDrawer.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import Button from "../custom/Button";
import Icon from "../../AppIcon";
import { formatCustomizations } from "../../../utils/cartFormat";
import cartDbService from "../../../services/cartDBService";
import CartMemberProgressModal, { computeMemberProgress } from "./CartMemberProgressModal";

export default function CartDrawer({
  isOpen,
  onClose,
  cartBadge,   // { count, total, name, cartId }
  cartPanel,   // { restaurant, items, fulfillment }
  onEditItem,  // (item) => void
  onRemoveItem, // (item) => void
  onRefresh    // () => void
}) {
  const navigate = useNavigate();
  const [showRoster, setShowRoster] = useState(false);
  const [roster, setRoster] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [rosterError, setRosterError] = useState("");
  const rosterFetchedRef = useRef(false);

  const loadRoster = useCallback(async ({ silent = false } = {}) => {
    if (!cartBadge?.cartId) return;
    if (!silent) setRosterLoading(true);
    setRosterError("");
    try {
      const list = await cartDbService.listCartMembersDetailed(cartBadge.cartId);
      setRoster(list);
    } catch (err) {
      const msg = err?.message || "Failed to load cart members.";
      setRosterError(msg);
      setRoster([]);
    } finally {
      setRosterLoading(false);
    }
  }, [cartBadge?.cartId]);

  useEffect(() => {
    if (!isOpen || !cartBadge?.cartId) return;
    if (rosterFetchedRef.current) return;
    rosterFetchedRef.current = true;
    loadRoster({ silent: true });
  }, [isOpen, cartBadge?.cartId, loadRoster]);

  useEffect(() => {
    if (!isOpen) setShowRoster(false);
  }, [isOpen]);

  const { orderedMembers, waitingMembers, extrasCount, unassignedCount, hasRecipients, assignmentMembers } = useMemo(
    () => computeMemberProgress({
      roster,
      items: cartPanel?.items || [],
      ownerMemberId: cartPanel?.ownerMemberId ?? null,
    }),
    [roster, cartPanel?.items, cartPanel?.ownerMemberId]
  );

  const rosterButtonVisible =
    (orderedMembers.length + waitingMembers.length > 0 || extrasCount > 0 || unassignedCount > 0) &&
    cartBadge?.cartId;

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1200] bg-black/40" onClick={onClose}>
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Cart"
      >
        {/* Header */}
        <div className="p-3 md:p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Icon name="ShoppingCart" size={18} />
              <span className="truncate">{cartBadge?.name || "Cart"}</span>
            </div>
            {rosterButtonVisible && (
              <button
                type="button"
                className="self-start text-xs font-medium text-primary underline-offset-2 transition hover:underline"
                onClick={() => {
                  setShowRoster(true);
                  loadRoster();
                }}
              >
                View order progress
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              aria-label="Refresh cart"
              title="Refresh"
            >
              <Icon name="RefreshCcw" size={18} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <Icon name="X" size={18} />
            </Button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {Array.isArray(cartPanel?.items) && cartPanel.items.length > 0 ? (
            <div className="divide-y divide-border border border-border rounded-md">
              {cartPanel.items.map((it, idx) => {
                const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
                const qty = Number(it?.quantity ?? 1);

                const lines = formatCustomizations(it) || [];
                const customizations = lines.length ? lines.join(", ") : null;

                const assigneesList = Array.isArray(it?.assignedTo) ? it.assignedTo.map((a) => a?.name).filter(Boolean) : [];
                let assignees = assigneesList.length ? assigneesList.join(', ') : it?.userName || null;
                if (!assignees) assignees = '-';

                const special = String(it?.specialInstructions || "").trim();

                return (
                  <div key={`${it?.id ?? "row"}-${idx}`} className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      {/* Left: text */}
                      <div className="min-w-0 flex-1">
                        {/* Name + qty/price inline (muted/smaller) */}
                        <div className="flex items-baseline gap-1.5">
                          <div className="text-sm font-medium text-foreground truncate">
                            {it?.name || "Item"}
                          </div>
                          <div className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap">
                            · x{qty} • ${unit.toFixed(2)}
                          </div>
                        </div>

                        {/* Assignees & customizations */}
                        {(assignees || customizations) && (
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            <>
                              For: <span className="text-foreground/90">{assignees}</span>
                            </>
                            {customizations && <span className="line-clamp-2">{customizations}</span>}
                          </div>
                        )}

                        {/* Special requests — its own line */}
                        {special && (
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            <span className="text-muted-foreground/70">Special requests:</span>{" "}
                            <span className="text-foreground/90">{special}</span>
                          </div>
                        )}
                      </div>

                      {/* Right: image */}
                      {it?.image && (
                        <img
                          src={it.image}
                          alt=""
                          className="h-12 w-12 rounded-md object-cover shrink-0"
                        />
                      )}
                    </div>

                    {/* Actions (icon-only) */}
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Edit item"
                        title="Edit item"
                        onClick={() => onEditItem?.(it)}
                      >
                        <Icon name="Pencil" size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        aria-label="Remove item"
                        title="Remove item"
                        onClick={() => onRemoveItem?.(it)}
                      >
                        <Icon name="Trash" size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">Your cart is empty.</div>
          )}
        </div>

        {/* Footer (fixed) */}
        <div className="p-3 md:p-4 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75 shrink-0">
          <div className="mb-2 flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
              Items: <span className="font-medium text-foreground">{cartBadge?.count || 0}</span>
            </div>
            <div className="text-muted-foreground">
              Subtotal:{" "}
              <span className="font-semibold text-foreground">
                ${Number(cartBadge?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          <Button
            className="w-full"
            onClick={() => {
              onClose?.();
              navigate(
                `/shopping-cart-checkout${cartBadge?.cartId ? `?cartId=${cartBadge.cartId}` : ""}`,
                {
                  state: {
                    cartId: cartBadge?.cartId || null,
                    fulfillment: cartPanel?.fulfillment || null,
                    restaurant: cartPanel?.restaurant || null,
                  },
                }
              );
            }}
            disabled={Number(cartBadge?.count || 0) === 0}
          >
            View Cart & Checkout
          </Button>
        </div>
      </aside>
      <CartMemberProgressModal
        open={showRoster}
        onClose={() => setShowRoster(false)}
        orderedMembers={orderedMembers}
        waitingMembers={waitingMembers}
        loading={rosterLoading}
        error={rosterError}
        extrasCount={extrasCount}
        unassignedCount={unassignedCount}
        hasRecipients={hasRecipients}
        assignmentMembers={assignmentMembers}
      />
    </div>,
    document.body
  );
}
