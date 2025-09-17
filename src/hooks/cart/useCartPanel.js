import { useCallback, useEffect, useState } from 'react';
import cartDbService from '@/services/cartDBService';

export default function useCartPanel(cartId) {
  const [badge, setBadge] = useState({ count: 0, total: 0, name: '', cartId });
  const [panel, setPanel] = useState({ restaurant: null, items: [], fulfillment: null });

  const refreshCart = useCallback(async () => {
    if (!cartId) return;
    const snap = await cartDbService.getCartSnapshot(cartId);
    if (!snap) return;

    const count = (snap.items || []).reduce((n, it) => n + Number(it.quantity || 0), 0);
    const total = (snap.items || []).reduce(
      (s, it) => s + Number(it.price || 0) * Number(it.quantity || 0),
      0
    );

    setBadge({
      count,
      total,
      name: snap.restaurant?.name || snap.cart?.title || 'Cart',
      cartId,
    });

    setPanel({
      restaurant: snap.restaurant,
      items: snap.items || [],
      fulfillment: {
        service: snap.cart?.fulfillment_service ?? null,
        address: snap.cart?.fulfillment_address ?? null,
        date: snap.cart?.fulfillment_date ?? null,
        time: snap.cart?.fulfillment_time ?? null,
      },
    });
  }, [cartId]);

  // initial load
  useEffect(() => { refreshCart(); }, [refreshCart]);

  // realtime updates (DB changes)
  useEffect(() => {
    if (!cartId) return;
    const unsubscribe = cartDbService.subscribeToCart(cartId, refreshCart);
    return unsubscribe;
  }, [cartId, refreshCart]);

  // local “cartUpdated” event (optimistic bump)
  useEffect(() => {
    const onUpdated = (e) => { if (e?.detail?.cartId === cartId) refreshCart(); };
    window.addEventListener('cartUpdated', onUpdated);
    return () => window.removeEventListener('cartUpdated', onUpdated);
  }, [cartId, refreshCart]);

  // helper used by the drawer
  const removeItem = useCallback(async (it) => {
    if (!cartId) return;
    await cartDbService.removeItem(cartId, it.id);
    await refreshCart();
    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartId } }));
  }, [cartId, refreshCart]);

  return { badge, panel, refreshCart, removeItem };
}
