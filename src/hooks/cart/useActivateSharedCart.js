// src/hooks/cart/useActivateSharedCart.js'

import { useEffect } from 'react';
import { useSharedCart } from '@/contexts/SharedCartContext';

export default function useActivateSharedCart(cartId) {
  const { setActiveCartId } = useSharedCart();
  useEffect(() => {
    if (cartId) setActiveCartId?.(cartId);
  }, [cartId, setActiveCartId]);
}
