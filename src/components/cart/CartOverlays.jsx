// /src/components/cart/CartOverlays.jsx

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts";
import cartDbService from "../../services/cartDBService";
import { formatCustomizations } from "../../utils/cartFormat";
import Button from "../ui/Button";
import Icon from "../AppIcon";

/** Keep this localized; header no longer needs these states/handlers. */
export default function CartOverlays() {
  const navigate = useNavigate();
  const { activeTeam } = useAuth();

  // Drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartBadge, setCartBadge] = useState({
    count: 0,
    total: 0,
    name: "Cart",
    cartId: null,
  });
  const [cartPanel, setCartPanel] = useState({
    restaurant: null,
    items: [],
    fulfillment: null,
  });

  // Hub state
  const [isCartHubOpen, setIsCartHubOpen] = useState(false);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubErr, setHubErr] = useState("");
  const [hubCarts, setHubCarts] = useState([]);

  // View Items modal
  const [viewCartSnapshot, setViewCartSnapshot] = useState(null);

  // Listen to global cart updates and open/close events
  useEffect(() => {
    const onBadge = (e) => {
      if (!e?.detail) return;
      const { restaurant, items, fulfillment, ...rest } = e.detail;
      setCartBadge((prev) => ({ ...prev, ...rest }));
      if (restaurant || items || fulfillment) {
        setCartPanel((p) => ({
          restaurant: restaurant ?? p.restaurant,
          items: Array.isArray(items) ? items : p.items,
          fulfillment: fulfillment ?? p.fulfillment,
        }));
      }
    };
    const onOpenDrawer = () => setIsCartOpen(true);
    const onCloseDrawer = () => setIsCartOpen(false);
    const onOpenHub = () => setIsCartHubOpen(true);

    window.addEventListener("cartBadge", onBadge);
    window.addEventListener("openCartDrawer", onOpenDrawer);
    window.addEventListener("closeCartDrawer", onCloseDrawer);
    window.addEventListener("openCartHub", onOpenHub);
    return () => {
      window.removeEventListener("cartBadge", onBadge);
      window.removeEventListener("openCartDrawer", onOpenDrawer);
      window.removeEventListener("closeCartDrawer", onCloseDrawer);
      window.removeEventListener("openCartHub", onOpenHub);
    };
  }, []);

  // Load hub carts when opening
  useEffect(() => {
    if (!isCartHubOpen || !activeTeam?.id) return;
    let cancelled = false;
    (async () => {
      setHubLoading(true);
      setHubErr("");
      try {
        const list = await cartDbService.listOpenCarts(activeTeam.id);
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
  }, [isCartHubOpen, activeTeam?.id]);

  // ----- handlers (moved from Header) -----
  const handleRemoveFromDrawer = (it) => {
    window.dispatchEvent(
      new CustomEvent("cartItemRemove", {
        detail: { cartId: cartBadge.cartId || null, itemId: it.id, menuItemId: it.menuItemId ?? null },
      })
    );
  };

  const handleEditFromDrawer = (it) => {
    setIsCartOpen(false);
    const rid = cartPanel.restaurant?.id || it.restaurantId || null;
    if (!rid) {
      navigate("/home-restaurant-discovery");
      return;
    }
    navigate(`/restaurant/${rid}`, {
      state: {
        cartId: cartBadge.cartId || null,
        restaurant: cartPanel.restaurant || null,
        editItem: { ...it, menuItemId: it.menuItemId ?? it.id },
      },
    });
  };

  const handleHubView = async (cart) => {
    try {
      const snap = await cartDbService.getCartSnapshot(cart.id);
      setViewCartSnapshot(snap);
    } catch (e) {
      alert(e?.message || "Failed to open cart.");
    }
  };

  const handleHubEdit = (cart) => {
    setIsCartHubOpen(false);
    const rid = cart.restaurant?.id;
    if (!rid) {
      navigate("/home-restaurant-discovery");
      return;
    }
    navigate(`/restaurant/${rid}`, {
      state: {
        cartId: cart.id,
        restaurant: cart.restaurant,
        fulfillment: cart.fulfillment || null,
      },
    });
  };

  const handleHubDelete = async (cart) => {
    const ok = window.confirm("Delete this cart and all its items? This cannot be undone.");
    if (!ok) return;
    try {
      await cartDbService.deleteCart(cart.id);
      setHubCarts((prev) => prev.filter((c) => c.id !== cart.id));
      if (cartBadge.cartId === cart.id) {
        setCartBadge({ count: 0, total: 0, name: "Cart", cartId: null });
        setCartPanel({ restaurant: null, items: [], fulfillment: null });
      }
    } catch (e) {
      alert(e?.message || "Failed to delete cart.");
    }
  };

  const formatDateTime = (c) => {
    const d = c?.fulfillment?.date;
    const t = c?.fulfillment?.time;
    if (!d && !t) return null;
    return [d, t].filter(Boolean).join(" • ");
  };

  // ----- render portals -----
  return (
    <>
      {/* Drawer */}
      {isCartOpen &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1200] bg-black/40" onClick={() => setIsCartOpen(false)}>
            <aside
              className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Cart"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="ShoppingCart" size={18} />
                  <span>{cartBadge.name || "Cart"}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCartOpen(false)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-160px)]">
                <div className="text-sm text-muted-foreground">
                  Items: <span className="font-medium text-foreground">{cartBadge.count}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Subtotal:{" "}
                  <span className="font-medium text-foreground">
                    ${(cartBadge.total || 0).toFixed(2)}
                  </span>
                </div>

                {cartPanel.items?.length > 0 && (
                  <div className="divide-y divide-border border border-border rounded-md">
                    {cartPanel.items.map((it, idx) => {
                      const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
                      const qty = Number(it?.quantity ?? 1);
                      const lines = formatCustomizations(it);
                      const assignees =
                        Array.isArray(it?.assignedTo) && it.assignedTo.length
                          ? it.assignedTo.map((a) => a?.name).filter(Boolean).join(", ")
                          : it?.userName || null;
                      return (
                        <div key={`${it?.id ?? "row"}-${idx}`} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {it?.name || "Item"}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                x{qty} • ${unit.toFixed(2)}
                              </div>
                              {assignees && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  For: <span className="text-foreground">{assignees}</span>
                                </div>
                              )}
                              {lines?.length > 0 && (
                                <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                  {lines.map((l, i) => (
                                    <li key={i}>{l}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            {it?.image && (
                              <img
                                src={it.image}
                                alt=""
                                className="h-14 w-14 rounded-md object-cover shrink-0"
                              />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditFromDrawer(it)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveFromDrawer(it)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate(
                      `/shopping-cart-checkout${
                        cartBadge.cartId ? `?cartId=${cartBadge.cartId}` : ""
                      }`,
                      {
                        state: {
                          cartId: cartBadge.cartId || null,
                          fulfillment: cartPanel.fulfillment || null,
                          restaurant: cartPanel.restaurant || null,
                        },
                      }
                    );
                  }}
                  disabled={cartBadge.count === 0}
                >
                  View Cart & Checkout
                </Button>
              </div>
            </aside>
          </div>,
          document.body
        )}

      {/* Hub */}
      {isCartHubOpen &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1200] bg-black/40" onClick={() => setIsCartHubOpen(false)}>
            <div
              className="absolute right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Saved Carts"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="ShoppingCart" size={18} />
                  <span>Saved Carts</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCartHubOpen(false)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-64px)]">
                {hubLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {hubErr && <div className="text-sm text-destructive">{hubErr}</div>}
                {!hubLoading && !hubErr && hubCarts.length === 0 && (
                  <div className="text-sm text-muted-foreground">No open carts yet.</div>
                )}

                {hubCarts.map((c) => (
                  <div key={c.id} className="border border-border rounded-md overflow-hidden">
                    <div className="p-3 flex items-start gap-3">
                      {c.restaurant?.image && (
                        <img
                          src={c.restaurant.image}
                          alt={c.restaurant?.name}
                          className="h-16 w-16 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {c.restaurant?.name || "Unknown Restaurant"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.title || "Cart"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(c) || "No date selected"} · {c.providerType || "provider"} ·{" "}
                          {c.itemCount} items
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Subtotal:{" "}
                          <span className="text-foreground">${c.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border p-3 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleHubView(c)}>
                        View
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleHubEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleHubDelete(c)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* View Items */}
      {viewCartSnapshot &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1300] bg-black/40" onClick={() => setViewCartSnapshot(null)}>
            <div
              className="absolute inset-0 md:inset-auto md:right-0 md:top-0 md:h-full w-full md:max-w-xl bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Cart Items"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="UtensilsCrossed" size={18} />
                  <span>{viewCartSnapshot.restaurant?.name || "Cart Items"}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setViewCartSnapshot(null)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-64px)]">
                {viewCartSnapshot.items?.map((it, idx) => {
                  const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
                  const qty = Number(it?.quantity ?? 1);
                  const lines = formatCustomizations(it);
                  const assignees =
                    Array.isArray(it?.assignedTo) && it.assignedTo.length
                      ? it.assignedTo.map((a) => a?.name).filter(Boolean).join(", ")
                      : it?.userName || null;
                  return (
                    <div key={`${it?.id ?? "row"}-${idx}`} className="p-3 border border-border rounded-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{it?.name || "Item"}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            x{qty} • ${unit.toFixed(2)}
                          </div>
                          {assignees && (
                            <div className="text-xs text-muted-foreground mt-1">
                              For: <span className="text-foreground">{assignees}</span>
                            </div>
                          )}
                          {lines?.length > 0 && (
                            <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                              {lines.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          )}
                          {it?.specialInstructions && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Notes: <span className="text-foreground">{it.specialInstructions}</span>
                            </div>
                          )}
                        </div>
                        {it?.image && (
                          <img src={it.image} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}