import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

const priceBucket = (avg) => {
  if (avg == null || Number.isNaN(avg)) return null;
  if (avg < 15) return '$';
  if (avg < 25) return '$$';
  if (avg < 35) return '$$$';
  return '$$$$';
};

const normalize = (r) => {
  const items = r.menu_items || [];
  const avgPrice = items.length
    ? items.reduce((s, it) => s + parseFloat(it.price ?? 0), 0) / items.length
    : null;

  return {
    id: r.id,
    name: r.name,
    image: r.image_url || undefined,
    cuisine: r.cuisine_type || '',
    description: undefined,
    address: r.address || '',
    rating: r.rating != null ? Number(r.rating) : undefined,
    distance: undefined,
    _distanceMeters: null,
    phone_number: r.phone_number || '',
    deliveryFee: r.delivery_fee != null ? String(r.delivery_fee) : undefined,
    status: r.is_available ? 'open' : 'closed',
    isFavorite: !!r.is_favorite,
    priceRange: priceBucket(avgPrice),
    features: r.supports_catering ? ['catering'] : [],
    _avgPrice: avgPrice,
    _items: items,
    _address: r.address || '',
    _coords: null,
    supported_providers: Array.isArray(r.supported_providers) ? r.supported_providers : ['grubhub'],
    provider_restaurant_ids: r.provider_restaurant_ids || {},
  };
};

export default function useRestaurantsSource() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(`
            id, name, cuisine_type, rating, image_url, address,
            delivery_fee, minimum_order, is_available, is_favorite,
            supports_catering, supported_providers, provider_restaurant_ids,
            menu_items ( id, name, description, price, category, image_url, is_available )
          `)
          .order('name', { ascending: true })
          .limit(200);

        if (error) throw error;
        if (cancelled) return;
        const mapped = (data || []).map(normalize);
        setRows(mapped);
        setHasLoadedOnce(true);
      } catch (e) {
        if (!cancelled) {
          setErr(e?.message || 'Failed to load restaurants');
          setRows([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { rows, setRows, loading, err, hasLoadedOnce };
}
