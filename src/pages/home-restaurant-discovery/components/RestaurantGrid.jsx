// src/pages/home-restaurant-discovery/components/RestaurantGrid.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import RestaurantCard from './RestaurantCard';
import Icon from '../../../components/AppIcon';
import {
  geocodeAddress,
  computeDistanceMeters,
  metersToMiles,
  formatMiles,
} from '../../../utils/googlePlaces';

const RestaurantGrid = ({
  selectedCategory,
  selectedService,
  appliedFilters,
  searchQuery,
  centerCoords,     // {lat,lng} or null
  radiusMiles = 3,  // number
}) => {
  const [rows, setRows] = useState([]);          // raw DB rows normalized
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [distanceReady, setDistanceReady] = useState(false);

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
      description: r.address || '',
      rating: r.rating != null ? Number(r.rating) : undefined,
      reviewCount: undefined,
      deliveryTime: undefined,
      distance: undefined,            // will set later
      _distanceMeters: null,          // internal
      deliveryFee: r.delivery_fee != null ? String(r.delivery_fee) : undefined,
      status: r.is_available ? 'open' : 'closed',
      promotion: null,
      isFavorite: !!r.is_favorite,
      priceRange: priceBucket(avgPrice),
      features: r.supports_catering ? ['catering'] : [],
      _avgPrice: avgPrice,
      _items: items,
      _address: r.address || '',
      _coords: null,                  // will fill via geocode
    };
  };

  // Load from DB
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      setDistanceReady(false);
      try {
        const { data, error } = await supabase
          .from('restaurants')
          .select(`
            id, name, cuisine_type, rating, image_url, address,
            delivery_fee, minimum_order, is_available, is_favorite,
            supports_catering,
            menu_items ( id, name, description, price, category, image_url, is_available )
          `)
          .order('name', { ascending: true })
          .limit(200);

        if (error) throw error;
        if (cancelled) return;

        setRows((data || []).map(normalize));
      } catch (e) {
        if (!cancelled) {
          console.error('Load restaurants failed:', e);
          setErr(e?.message || 'Failed to load restaurants');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Geocode + compute distance when we have a center
  useEffect(() => {
    let cancelled = false;
    if (!centerCoords || rows.length === 0) {
      setDistanceReady(true); // nothing to do; allow render without distance
      return;
    }

    (async () => {
      try {
        const updated = [...rows];
        // Geocode sequentially to be gentle on API; you can parallelize if needed.
        for (let i = 0; i < updated.length; i++) {
          if (cancelled) return;

          const r = updated[i];
          // if already have coords, skip; else geocode by address
          if (!r._coords && r._address) {
            try {
              r._coords = await geocodeAddress(r._address);
            } catch (e) {
              // keep null on failure; silently continue
              r._coords = null;
            }
          }

          // distance
          if (r._coords) {
            const meters = await computeDistanceMeters(centerCoords, r._coords);
            r._distanceMeters = meters ?? null;
            const miles = metersToMiles(meters ?? null);
            r.distance = miles != null ? formatMiles(miles) : undefined;
          } else {
            r._distanceMeters = null;
            r.distance = undefined;
          }
        }

        if (!cancelled) {
          setRows(updated);
          setDistanceReady(true);
        }
      } catch (e) {
        console.warn('Distance calc failed:', e);
        if (!cancelled) setDistanceReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [centerCoords, rows.length]);

  // Client filtering + radius filter
  const filtered = useMemo(() => {
    let list = [...rows];

    // Category
    if (selectedCategory && selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      list = list.filter((r) => {
        const c = (r.cuisine || '').toLowerCase();
        if (cat === 'pizza') return c.includes('italian') || c.includes('pizza');
        if (cat === 'asian') return ['chinese','japanese','thai','korean','asian'].some(x => c.includes(x));
        return c.includes(cat);
      });
    }

    // Search
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((r) => {
        const inHeader =
          r.name?.toLowerCase().includes(q) ||
          r.cuisine?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q);
        if (inHeader) return true;
        return (r._items || []).some(
          (it) =>
            it.name?.toLowerCase().includes(q) ||
            it.description?.toLowerCase().includes(q) ||
            it.category?.toLowerCase().includes(q)
        );
      });
    }

    // Advanced filters
    if (appliedFilters) {
      if (appliedFilters.priceRange?.length) {
        const set = new Set(appliedFilters.priceRange);
        list = list.filter((r) => (r.priceRange ? set.has(r.priceRange) : false));
      }
      if (appliedFilters.rating) {
        const min = parseFloat(appliedFilters.rating);
        list = list.filter((r) => (r.rating ?? 0) >= min);
      }
      if (appliedFilters.cuisineTypes?.length) {
        const wants = appliedFilters.cuisineTypes.map((c) => c.toLowerCase());
        list = list.filter((r) =>
          wants.some((w) => (r.cuisine || '').toLowerCase().includes(w))
        );
      }
    }

    // Radius filter (only when we have a center & (soon) distances computed)
    if (centerCoords && radiusMiles && radiusMiles > 0) {
      const maxMeters = radiusMiles * 1609.344;
      list = list.filter((r) => r._distanceMeters != null && r._distanceMeters <= maxMeters);
    }

    // Sort: if we have distances, sort by distance asc; else rating desc then name
    list.sort((a, b) => {
      const da = a._distanceMeters ?? Infinity;
      const db = b._distanceMeters ?? Infinity;
      if (da !== db) return da - db;

      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;

      return a.name.localeCompare(b.name);
    });

    return list;
  }, [rows, selectedCategory, appliedFilters, searchQuery, centerCoords, radiusMiles]);

  // Render states
  if ((loading && rows.length === 0) || (!distanceReady && centerCoords)) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border border-border overflow-hidden">
              <div className="h-48 bg-muted animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted animate-pulse" />
                <div className="h-3 bg-muted animate-pulse" />
                <div className="h-3 bg-muted animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="px-4 py-12 lg:px-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="AlertTriangle" size={24} className="text-error" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Couldn’t load restaurants</h3>
          <p className="text-muted-foreground mb-4">{err}</p>
        </div>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="px-4 py-12 lg:px-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Search" size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No restaurants found</h3>
          <p className="text-muted-foreground">Try expanding your radius or adjusting filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          {filtered.length} restaurants
        </h2>
        {centerCoords && (
          <div className="text-sm text-muted-foreground">
            within ~{radiusMiles} mi
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} selectedService={selectedService} />
        ))}
      </div>
    </div>
  );
};

export default RestaurantGrid;