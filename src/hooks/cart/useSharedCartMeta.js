// src/hooks/cart/useSharedCartMeta.js

import { useEffect, useMemo, useState } from 'react';
import cartDbService from '@/services/cartDBService';
import { pickDefaultProvider } from '@/services/menuProviderService';
import useDistanceMiles from '@/hooks/common/useDistanceMiles';

export default function useSharedCartMeta(cartId) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [snap, setSnap] = useState(null); // { cart, restaurant, team, creator }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const s = await cartDbService.getSharedCartMeta(cartId);
        if (!cancelled) setSnap(s);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load shared cart.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cartId]);

  const restaurant = snap?.restaurant || null;

  const lockedProvider =
    snap?.cart?.providerType ||
    pickDefaultProvider(restaurant?.supported_providers || ['grubhub']);

  const creatorName = snap?.creator?.fullName || null;

  const teamLine = (snap?.team?.name && snap?.team?.gender && snap?.team?.sport)
    ? `${snap.team.name} • ${snap.team.gender} ${snap.team.sport}`
    : 'Your Team • Girls Soccer';

  // distance & hero model
  const computedDistanceMi = useDistanceMiles({
    restaurant,
    fulfillment: {
      service:  snap?.cart?.fulfillment?.service || null,
      address:  snap?.cart?.fulfillment?.address || null,
      coords:   snap?.cart?.fulfillment?.coords || null,
      date:     snap?.cart?.fulfillment?.date   || null,
      time:     snap?.cart?.fulfillment?.time   || null,
    }
  });

  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image,
      cuisine: restaurant.cuisine_type || restaurant.cuisine || '',
      rating: n(restaurant.rating),
      distance: n(restaurant.distance) ?? computedDistanceMi,
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      coordinates: restaurant._coords || undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [], ratingBreakdown: [], reviews: []
    };
  }, [restaurant, computedDistanceMi]);

  return {
    loading,
    error: err,
    snap,
    restaurant,
    lockedProvider,
    creatorName,
    teamLine,
    heroRestaurant,
    computedDistanceMi,
  };
}
