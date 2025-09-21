// src/hooks/cart/useLockedProviderMenu.js

import { useProviderMenu } from '@/hooks/restaurant-details';

export default function useLockedProviderMenu({ restaurant, provider }) {
  const {
    providerCategories,
    providerItemsByCat,
    loadingMenu,
    providerError,
  } = useProviderMenu({ restaurant, provider });

  return {
    providerCategories,
    providerItemsByCat,
    loadingMenu,
    providerError,
  };
}
