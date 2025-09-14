// src/hooks/cart/useCartOnPage.js
import { useEffect, useState } from 'react';

export default function useCartOnPage({
  activeTeam, restaurant, provider, fulfillment,
  setProvider, setActiveCartId, location,
  cartDbService, EXTRA_SENTINEL
}) {
  const [cartId, setCartId] = useState(null);

  // If coming from Hub, hydrate (and optionally open)
  useEffect(() => {
    const incoming = location.state?.cartId;
    const openCartOnLoad = location.state?.openCartOnLoad === true;
    if (!incoming) return;

    setCartId(incoming);
    setActiveCartId?.(incoming);

    (async () => {
      const snap = await cartDbService.getCartSnapshot(incoming);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: incoming,
          restaurant: snap.restaurant,
          items: snap.items,
          fulfillment: location.state?.fulfillment || fulfillment,
        },
      }));
      if (openCartOnLoad) window.dispatchEvent(new Event('openCartDrawer'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.cartId, location.state?.openCartOnLoad]);

  // Lookup an existing cart for this restaurant/provider if not supplied
  useEffect(() => {
    if (!activeTeam?.id || !restaurant?.id) return;
    if (location.state?.cartId) return;
    let cancelled = false;
    (async () => {
      const id = await cartDbService.findActiveCartForRestaurant(activeTeam.id, restaurant.id, provider);
      if (!id || cancelled) return;
      setCartId(id);
      const snap = await cartDbService.getCartSnapshot(id);
      if (!snap || cancelled) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
          fulfillment,
        },
      }));
    })();
    return () => { cancelled = true; };
  }, [activeTeam?.id, restaurant?.id, provider, location.state?.cartId]); // deliberate omissions

  // Subscribe realtime to keep drawer fresh
  useEffect(() => {
    if (!cartId) return;
    const unsubscribe = cartDbService.subscribeToCart(cartId, async () => {
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    });
    return unsubscribe;
  }, [cartId]);

  // Drawer "Remove"
  useEffect(() => {
    const onRemove = async (e) => {
      const { cartId: evtCartId, itemId } = e?.detail || {};
      if (!itemId || !evtCartId || evtCartId !== cartId) return;
      await cartDbService.removeItem(cartId, itemId);
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    };
    window.addEventListener('cartItemRemove', onRemove);
    return () => window.removeEventListener('cartItemRemove', onRemove);
  }, [cartId]);

  // Add/Update item
  const handleAddToCart = async (customizedItem, quantity) => {
    let id = cartId;

    if (!id) {
      if (!activeTeam?.id || !restaurant?.id) return;
      id = await cartDbService.ensureCartForRestaurant(
        activeTeam.id, restaurant.id,
        {
          title: `${restaurant.name} • ${provider}`,
          providerType: provider,
          providerRestaurantId: restaurant?.provider_restaurant_ids?.[provider] || null,
        }
      );
      await cartDbService.upsertCartFulfillment(id, fulfillment, {
        title: `${restaurant.name} • ${provider}`,
        providerType: provider,
        providerRestaurantId: restaurant?.provider_restaurant_ids?.[provider] || null,
      });
      setCartId(id);
      setProvider(provider);
    }

    const memberIds = (customizedItem.assignedTo || []).map(a => a?.id).filter(Boolean);
    const extraCount = (customizedItem.assignedTo || []).filter(a => a?.name === 'Extra' || a?.id === EXTRA_SENTINEL).length;
    const displayNames = (customizedItem.assignedTo || []).map(a => a?.name).filter(Boolean);

    const selectedOptions = customizedItem.selectedOptions || {};
    const unitPrice = typeof customizedItem.customizedPrice === 'number'
      ? customizedItem.customizedPrice
      : Number(customizedItem.price || 0);

    if (customizedItem.cartRowId) {
      const selWithAssign = {
        ...selectedOptions,
        __assignment__: { member_ids: memberIds, extra_count: extraCount, display_names: displayNames },
      };
      await cartDbService.updateItem(id, customizedItem.cartRowId, {
        quantity,
        price: unitPrice,
        special_instructions: customizedItem.specialInstructions || '',
        selected_options: selWithAssign,
      });
    } else {
      await cartDbService.addItem(id, {
        menuItem: { id: customizedItem.id, name: customizedItem.name, image: customizedItem.image },
        quantity,
        unitPrice,
        specialInstructions: customizedItem.specialInstructions || '',
        selectedOptions,
        assignment: { memberIds, extraCount, displayNames },
      });
    }

    const snap = await cartDbService.getCartSnapshot(id);
    if (snap) {
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    }
  };

  return { cartId, handleAddToCart };
}