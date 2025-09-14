// src/hooks/restaurant-details/useProviderMenu.js
import { useEffect, useMemo, useState } from 'react';
import { fetchMenu } from '../../services/menuProviderService';
import { groupFlatMenu } from '../../utils/menuGrouping';

export default function useProviderMenu({ restaurant, provider }) {
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [providerError, setProviderError] = useState('');
  const [flat, setFlat] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProviderError('');
      setLoadingMenu(true);
      try {
        if (!restaurant || !provider) return;
        const items = await fetchMenu({ provider, restaurant });
        if (!cancelled) setFlat(items || []);
      } catch (e) {
        if (!cancelled) setProviderError('Failed to load menu for this provider.');
      } finally {
        if (!cancelled) setLoadingMenu(false);
      }
    })();
    return () => { cancelled = true; };
  }, [restaurant, provider]);

  const normalized = useMemo(() => {
    // normalize to the shape MenuSection expects
    const prepared = (flat || []).map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description || '',
      price: Number(it.price ?? 0),
      image: it.image || it.image_url || '',
      isPopular: !!it.isPopular,
      calories: it.calories ?? undefined,
      dietaryInfo: it.dietaryInfo ?? undefined,
      hasCustomizations: !!(it.options || it.options_json || it.sizes || it.toppings),
      options: it.options || it.options_json || null,
      sizes: it.sizes || [],
      toppings: it.toppings || [],
      category: it.category || 'Menu',
    }));
    return groupFlatMenu(prepared);
  }, [flat]);

  return {
    providerCategories: normalized.categories,
    providerItemsByCat: normalized.itemsByCat,
    loadingMenu,
    providerError,
  };
}