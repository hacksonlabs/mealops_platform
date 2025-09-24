import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../contexts";
import Button from "../custom/Button";
import Icon from "../../AppIcon";
import CartHub from "./CartHub";
import CartDetailsModal from "./CartDetailsModal";
import CartDrawer from "./CartDrawer";
import cartDbService from "../../../services/cartDBService";
import { formatCustomizations } from "../../../utils/cartFormat";

export default function CartOverlays() {
  const navigate = useNavigate();
  const { activeTeam } = useAuth();

  // Drawer state
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartBadge, setCartBadge] = useState({ count: 0, total: 0, name: "Cart", cartId: null });
  const [cartPanel, setCartPanel] = useState({ restaurant: null, items: [], fulfillment: null });

  // Hub state
  const [isCartHubOpen, setIsCartHubOpen] = useState(false);

  // NEW: details modal state (open when a cart is viewed)
  const [detailsCartId, setDetailsCartId] = useState(null);

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

  // Drawer handlers
  const refreshCart = () => {
    // Full page refresh to ensure all widgets reflect latest state
    window.location.reload();
  };
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

  // HUB actions
  const handleHubView = (cart) => {
    setIsCartHubOpen(false);
    setDetailsCartId(cart.id);
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
        provider: cart.providerType || null,
        openCartOnLoad: true,
      },
    });
  };

  const handleHubDeleted = (cart) => {
    if (cartBadge.cartId === cart.id) {
      setCartBadge({ count: 0, total: 0, name: "Cart", cartId: null });
      setCartPanel({ restaurant: null, items: [], fulfillment: null });
    }
  };

  return (
    <>
      {/* Drawer */}
      {isCartOpen && (
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartBadge={cartBadge}
          cartPanel={cartPanel}
          onEditItem={handleEditFromDrawer}
          onRemoveItem={handleRemoveFromDrawer}
          onRefresh={refreshCart}
        />
      )}

      {/* Hub */}
      {isCartHubOpen && (
        <CartHub
          isOpen={isCartHubOpen}
          onClose={() => setIsCartHubOpen(false)}
          activeTeamId={activeTeam?.id}
          onView={handleHubView}      // ⬅️ opens details modal
          onEdit={handleHubEdit}
          onDeleted={handleHubDeleted}
        />
      )}

      {/* Details modal (opens on Hub "View") */}
      {detailsCartId && (
        <CartDetailsModal
          isOpen={Boolean(detailsCartId)}
          cartId={detailsCartId}
          onClose={() => setDetailsCartId(null)}
        />
      )}
    </>
  );
}
