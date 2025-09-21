// src/hooks/restaurant-details/useRestaurantWithDbMenu.js
import { useEffect, useState } from 'react';

const needsHydration = (r) => {
  if (!r) return true;
  const hasRating = Number.isFinite(Number(r.rating));
  const hasLoc = !!(r._coords || (r.lat && r.lng) || r.address);
  return !hasRating || !hasLoc;
};

export default function useRestaurantWithDbMenu({ supabase, restaurantId, initialRestaurant, location }) {
  const [restaurant, setRestaurant] = useState(initialRestaurant || null);
  const [menuRaw, setMenuRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        let rest = restaurant;

        if (!rest || needsHydration(rest)) {
          const { data, error } = await supabase
            .from('restaurants')
            .select('id, name, image_url, cuisine_type, rating, phone_number, address, is_available, supports_catering, delivery_fee, minimum_order, supported_providers, provider_restaurant_ids, api_id')
            .or(`id.eq.${restaurantId},api_id.eq.${restaurantId}`)
            .maybeSingle();
          if (error) throw error;
          if (!data) throw new Error('Restaurant not found');
          rest = { ...rest, ...data };
        }

        const { data: mi, error: miErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('category', { ascending: true })
          .order('name', { ascending: true });
        if (miErr) throw miErr;

        if (!cancelled) {
          const inboundDistance = location.state?.restaurant?.distance;
          setRestaurant(prev => ({
            ...prev,
            ...rest,
            distance: prev?.distance ?? inboundDistance ?? rest.distance
          }));
          setMenuRaw(mi || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load restaurant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  return { restaurant, setRestaurant, menuRaw, loading, err };
}