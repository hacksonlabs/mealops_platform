// src/pages/shared-cart/components/SharedCartDrawer.jsx
import React from "react";
import ReactDOM from "react-dom";
// ❌ remove useNavigate
import Icon from "../../../components/AppIcon";
import Button from "../../../components/ui/custom/Button";
import { formatCustomizations } from "../../../utils/cartFormat";

export default function SharedCartDrawer({
  isOpen,
  onClose,
  cartBadge,   // { count, total, name, cartId }
  cartPanel,   // { restaurant, items, fulfillment }
  onEditItem,  // (item) => void
  onRemoveItem // (item) => void
}) {
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
          <div className="font-semibold flex items-center gap-2">
            <Icon name="ShoppingCart" size={18} />
            <span className="truncate">{cartBadge?.name || "Cart"}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
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

                const assignees =
                  Array.isArray(it?.assignedTo) && it.assignedTo.length
                    ? it.assignedTo.map((a) => a?.name).filter(Boolean).join(", ")
                    : it?.userName || null;

                const special = String(it?.specialInstructions || "").trim();

                return (
                  <div key={`${it?.id ?? "row"}-${idx}`} className="p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-1.5">
                          <div className="text-sm font-medium text-foreground truncate">
                            {it?.name || "Item"}
                          </div>
                          <div className="text-[12px] text-muted-foreground shrink-0 whitespace-nowrap">
                            · x{qty} • ${unit.toFixed(2)}
                          </div>
                        </div>

                        {(assignees || customizations) && (
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {assignees && (
                              <>
                                For: <span className="text-foreground/90">{assignees}</span>
                              </>
                            )}
                            {customizations && <span className="line-clamp-2">{customizations}</span>}
                          </div>
                        )}

                        {special && (
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            <span className="text-muted-foreground/70">Special requests:</span>{" "}
                            <span className="text-foreground/90">{special}</span>
                          </div>
                        )}
                      </div>

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
                        onClick={() => {
													onClose?.();
													// tiny defer to avoid overlap in portals
													setTimeout(() => onEditItem?.(it), 0);
													}}
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

        {/* Footer (fixed) — no checkout button, just a friendly message */}
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

          <div className="text-sm rounded-md bg-muted px-3 py-2 text-center">
            {Number(cartBadge?.count || 0) > 0
              ? "You're all set — your items are in the cart!"
              : "Add something tasty to get started."}
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}