// src/pages/home-restaurant-discovery/components/RestaurantGrid.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import RestaurantCard from './RestaurantCard';
import Icon from '../../../components/AppIcon';

const RestaurantGrid = ({ selectedCategory, selectedService, appliedFilters, searchQuery }) => {
  const [rows, setRows] = useState([]);          // raw DB rows
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // --- helpers ---
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
      description: r.address || '',           // light fallback (you can swap for r.notes)
      rating: r.rating != null ? Number(r.rating) : undefined,
      reviewCount: undefined,                 // not in schema (leave undefined)
      deliveryTime: undefined,                // not in schema (leave undefined)
      distance: undefined,                    // not in schema (leave undefined)
      deliveryFee: r.delivery_fee != null ? String(r.delivery_fee) : undefined,
      status: r.is_available ? 'open' : 'closed',
      promotion: null,
      isFavorite: !!r.is_favorite,
      priceRange: priceBucket(avgPrice),
      // features: derive if you want (e.g., supports_catering)
      features: r.supports_catering ? ['catering'] : [],
      _avgPrice: avgPrice,                    // internal use only
      _items: items,                          // internal (for search)
    };
  };

  // --- load ---
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErr('');
      try {
        // Pull restaurants + menu items (needed for price buckets & optional text search)
        const { data, error } = await supabase
          .from('restaurants')
          .select(`
            id, name, cuisine_type, rating, image_url, address,
            delivery_fee, minimum_order, is_available, is_favorite,
            supports_catering,
            menu_items (
              id, name, description, price, category, image_url, is_available
            )
          `)
          .order('name', { ascending: true })  // cheap stable order
          .limit(200); // adjust as needed

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
    };

    load();
    return () => { cancelled = true; };
  }, []); // initial load once

  // --- filtering (client-side; easy to move server-side later) ---
  const filtered = useMemo(() => {
    let list = [...rows];

    // Selected category (maps to cuisine)
    if (selectedCategory && selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      list = list.filter((r) => {
        const c = (r.cuisine || '').toLowerCase();
        if (cat === 'pizza') return c.includes('italian') || c.includes('pizza');
        if (cat === 'asian') return ['chinese','japanese','thai','korean','asian'].some(x => c.includes(x));
        return c.includes(cat);
      });
    }

    // Search query: name, cuisine, address/description, menu item names
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
      // Price ranges
      if (appliedFilters.priceRange?.length) {
        const set = new Set(appliedFilters.priceRange);
        list = list.filter((r) => (r.priceRange ? set.has(r.priceRange) : false));
      }

      // Rating
      if (appliedFilters.rating) {
        const min = parseFloat(appliedFilters.rating);
        list = list.filter((r) => (r.rating ?? 0) >= min);
      }

      // Cuisine types
      if (appliedFilters.cuisineTypes?.length) {
        const wants = appliedFilters.cuisineTypes.map((c) => c.toLowerCase());
        list = list.filter((r) =>
          wants.some((w) => (r.cuisine || '').toLowerCase().includes(w))
        );
      }
    }

    // Example sort: by rating desc, then name
    list.sort((a, b) => {
      const ra = a.rating ?? 0;
      const rb = b.rating ?? 0;
      if (rb !== ra) return rb - ra;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [rows, selectedCategory, appliedFilters, searchQuery]);

  // --- render states ---
  if (loading && rows.length === 0) {
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
          <p className="text-muted-foreground">Try adjusting your filters or search.</p>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((r) => (
          <RestaurantCard key={r.id} restaurant={r} />
        ))}
      </div>
    </div>
  );
};

export default RestaurantGrid;