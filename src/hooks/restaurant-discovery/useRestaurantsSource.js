import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { featureFlags } from '@/config/runtimeConfig';
import { mealmeApi } from '@/services/mealmeApi';

const priceBucket = (avg) => {
  if (avg == null || Number.isNaN(avg)) return null;
  if (avg < 15) return '$';
  if (avg < 25) return '$$';
  if (avg < 35) return '$$$';
  return '$$$$';
};

const normalizeSupabase = (r) => {
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

const normalizeMealMe = (r) => {
  if (!r) return null;
  const avgPrice = r.average_item_price_cents != null
    ? Number(r.average_item_price_cents) / 100
    : r.avg_price != null
      ? Number(r.avg_price)
      : null;

  const distanceMeters = (() => {
    if (r.distance_meters != null) return Number(r.distance_meters);
    if (r.distance_miles != null) return Number(r.distance_miles) * 1609.344;
    if (r.distance != null) return Number(r.distance) * 1609.344;
    return null;
  })();

  const supportedProviders = Array.isArray(r.supported_marketplaces)
    ? r.supported_marketplaces
    : Array.isArray(r.marketplaces)
      ? r.marketplaces
      : Array.isArray(r.supported_providers)
        ? r.supported_providers
        : ['mealme'];

  const providerIds = { ...(r.provider_ids || r.provider_restaurant_ids || {}) };
  if (!providerIds.mealme && (r.id || r.provider_restaurant_id)) {
    providerIds.mealme = r.id || r.provider_restaurant_id;
  }

  return {
    id: r.id || r.restaurant_id || r.provider_restaurant_id || r.external_id,
    name: r.name || r.display_name || r.restaurant_name || 'Restaurant',
    image: r.image_url || r.logo_url || r.photo_url || undefined,
    cuisine: r.cuisine || r.cuisine_type || r.primary_cuisine || '',
    description: r.description || r.summary || undefined,
    address: r.address || r.formatted_address || r.location || '',
    rating: r.rating != null ? Number(r.rating) : (r.average_rating != null ? Number(r.average_rating) : undefined),
    distance: distanceMeters != null ? distanceMeters / 1609.344 : undefined,
    _distanceMeters: distanceMeters,
    phone_number: r.phone_number || r.phone || r.contact_phone || '',
    deliveryFee: r.delivery_fee_cents != null
      ? (Number(r.delivery_fee_cents) / 100).toFixed(2)
      : r.delivery_fee != null
        ? String(r.delivery_fee)
        : undefined,
    status: r.is_open === false || r.open_now === false ? 'closed' : 'open',
    isFavorite: false,
    priceRange: r.price_range || r.price_bucket || (avgPrice != null ? priceBucket(avgPrice) : null),
    features: Array.isArray(r.tags) ? r.tags : [],
    _avgPrice: avgPrice,
    _items: Array.isArray(r.menu_items) ? r.menu_items : [],
    _address: r.address || r.formatted_address || '',
    _coords: r.coordinates || r.location_coordinates || null,
    supported_providers: supportedProviders,
    provider_restaurant_ids: providerIds,
  };
};

export default function useRestaurantsSource({ fulfillment, centerCoords, selectedService, searchQuery } = {}) {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const useMealMe = useMemo(() => featureFlags.mealMeEnabled, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        if (useMealMe && centerCoords?.lat != null && centerCoords?.lng != null) {
          const normalizedQuery = (searchQuery || '').trim();
          const payload = {
            latitude: Number(centerCoords.lat),
            longitude: Number(centerCoords.lng),
            service_type: selectedService || fulfillment?.service || 'delivery',
            query: normalizedQuery.length >= 3 ? normalizedQuery : undefined,
            when: fulfillment?.date && fulfillment?.time
              ? `${fulfillment.date}T${fulfillment.time}`
              : undefined,
          };
          const result = await mealmeApi.searchRestaurants(payload);
          if (cancelled) return;
          const list = result?.restaurants || result?.items || result?.data || [];
          const mapped = list.map(normalizeMealMe).filter(Boolean);
          setRows(mapped);
          setHasLoadedOnce(true);
        } else {
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
          const mapped = (data || []).map(normalizeSupabase);
          setRows(mapped);
          setHasLoadedOnce(true);
        }
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
  }, [useMealMe, centerCoords?.lat, centerCoords?.lng, fulfillment?.service, fulfillment?.date, fulfillment?.time, searchQuery, selectedService]);

  return { rows, setRows, loading, err, hasLoadedOnce };
}
