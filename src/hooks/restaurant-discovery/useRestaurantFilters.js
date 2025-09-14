import { useMemo } from 'react';

export default function useRestaurantFilters(rows, {
  selectedCategory,
  appliedFilters,
  searchQuery,
  centerCoords,
  radiusMiles,
}) {
  return useMemo(() => {
    let list = [...rows];

    // category
    if (selectedCategory && selectedCategory !== 'all') {
      const cat = selectedCategory.toLowerCase();
      list = list.filter((r) => {
        const c = (r.cuisine || '').toLowerCase();
        if (cat === 'pizza') return c.includes('italian') || c.includes('pizza');
        if (cat === 'asian') return ['chinese','japanese','thai','korean','asian'].some(x => c.includes(x));
        return c.includes(cat);
      });
    }

    // search
    if (searchQuery?.trim()) {
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

    // advanced filters
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
        list = list.filter((r) => wants.some((w) => (r.cuisine || '').toLowerCase().includes(w)));
      }
    }

    // radius
    if (centerCoords && radiusMiles && radiusMiles > 0) {
      const maxMeters = radiusMiles * 1609.344;
      list = list.filter((r) => r._distanceMeters != null && r._distanceMeters <= maxMeters);
    }

    // sort
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
}
