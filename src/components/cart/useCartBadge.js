// /src/components/cart/useCartBadge.js

import { useEffect, useState } from "react";

export default function useCartBadge() {
  const [badge, setBadge] = useState({
    count: 0,
    total: 0,
    name: "Cart",
    cartId: null,
  });

  useEffect(() => {
    const onBadge = (e) => {
      if (!e?.detail) return;
      const { restaurant, items, fulfillment, ...rest } = e.detail;
      setBadge((prev) => ({ ...prev, ...rest }));
    };
    window.addEventListener("cartBadge", onBadge);
    return () => window.removeEventListener("cartBadge", onBadge);
  }, []);

  return badge;
}
