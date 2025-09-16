import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import Button from "../custom/Button";
import Icon from "../../AppIcon";
import cartDbService from "../../../services/cartDBService";

export default function CartHub({
  isOpen,
  onClose,
  activeTeamId,
  onView,
  onEdit,
  onDeleted,
}) {
  const [hubLoading, setHubLoading] = useState(false);
  const [hubErr, setHubErr] = useState("");
  const [hubCarts, setHubCarts] = useState([]);

  // Load hub carts when opening
  useEffect(() => {
    if (!isOpen || !activeTeamId) return;
    let cancelled = false;
    (async () => {
      setHubLoading(true);
      setHubErr("");
      try {
        const list = await cartDbService.listOpenCarts(activeTeamId);
        if (!cancelled) setHubCarts(list);
      } catch (e) {
        if (!cancelled) setHubErr(e?.message || "Failed to load carts");
      } finally {
        if (!cancelled) setHubLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTeamId]);

  // Compact, readable date like "Tue, Sep 16 • 12:30 PM"
  const formatDateTime = (c) => {
    const dStr = c?.fulfillment?.date; // YYYY-MM-DD
    const tStr = c?.fulfillment?.time; // HH:mm[:ss]
    if (!dStr && !tStr) return null;
    const hhmm = tStr ? String(tStr).slice(0, 5) : "12:00";
    const dt = new Date(`${dStr || new Date().toISOString().slice(0, 10)}T${hhmm}`);
    if (Number.isNaN(dt.getTime())) return [dStr, tStr].filter(Boolean).join(" • ");
    const datePart = dStr
      ? dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
      : null;
    const timePart = tStr
      ? dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : null;
    return [datePart, timePart].filter(Boolean).join(" • ");
  };

  const handleDelete = async (cart) => {
    const ok = window.confirm("Delete this cart and all its items? This cannot be undone.");
    if (!ok) return;
    try {
      await cartDbService.deleteCart(cart.id);
      setHubCarts((prev) => prev.filter((c) => c.id !== cart.id));
      onDeleted?.(cart);
    } catch (e) {
      alert(e?.message || "Failed to delete cart.");
    }
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[1200] bg-black/40" onClick={onClose}>
      <div
        className="absolute right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Saved Carts"
      >
        {/* Header */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="font-semibold flex items-center gap-2">
            <Icon name="ShoppingCart" size={18} />
            <span>Saved Carts</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
        </div>

        {/* List */}
        <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-56px)]">
          {hubLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
          {hubErr && <div className="text-sm text-destructive">{hubErr}</div>}
          {!hubLoading && !hubErr && hubCarts.length === 0 && (
            <div className="text-sm text-muted-foreground">No open carts yet.</div>
          )}

          {hubCarts.map((c) => {
            const when = formatDateTime(c) || "No date selected";
            const itemsLabel = `${c.itemCount} item${c.itemCount === 1 ? "" : "s"}`;
            const subtotal = `$${(c.subtotal || 0).toFixed(2)}`;

            return (
              <div
                key={c.id}
                className="group flex items-center gap-3 p-2.5 border border-border rounded-md hover:bg-muted/40 transition-colors"
              >
                {c.restaurant?.image && (
                  <img
                    src={c.restaurant.image}
                    alt={c.restaurant?.name}
                    className="h-12 w-12 rounded object-cover shrink-0"
                  />
                )}

                {/* Main */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {c.restaurant?.name || "Unknown Restaurant"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{c.title || "Cart"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {when} · {itemsLabel} · <span className="text-foreground">{subtotal}</span>
                      </div>
                    </div>

                    {/* Actions (icon-only) */}
                    <div className="shrink-0 flex items-center gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onView?.(c)}
                        aria-label="View cart"
                        title="View"
                      >
                        <Icon name="Eye" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit?.(c)}
                        aria-label="Edit cart"
                        title="Edit"
                      >
                        <Icon name="Pencil" size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(c)}
                        aria-label="Delete cart"
                        title="Delete"
                        className="text-destructive"
                      >
                        <Icon name="Trash" size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
