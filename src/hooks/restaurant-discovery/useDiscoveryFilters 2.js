import { useCallback, useMemo, useState } from 'react';

const EMPTY = { priceRange: [], rating: '', cuisineTypes: [] };

export default function useDiscoveryFilters(initial = EMPTY) {
  const [filters, setFilters] = useState(initial);

  const activeCount = useMemo(
    () =>
      (filters.priceRange?.length || 0) +
      (filters.cuisineTypes?.length || 0) +
      (filters.rating ? 1 : 0),
    [filters]
  );

  const clearAll = useCallback(() => setFilters(EMPTY), []);

  const removeChip = useCallback((kind, id) => {
    setFilters(prev => {
      if (kind === 'priceRange' || kind === 'cuisineTypes') {
        const next = new Set(prev[kind] || []);
        next.delete(id);
        return { ...prev, [kind]: Array.from(next) };
      }
      if (kind === 'rating') return { ...prev, rating: '' };
      return prev;
    });
  }, []);

  return { filters, setFilters, activeCount, clearAll, removeChip };
}