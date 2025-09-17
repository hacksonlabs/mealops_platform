// src/hooks/cart/useMenuSearchFilters.js
import { useMenuFiltering } from '@/hooks/restaurant-details';

export default function useMenuSearchFilter({ providerItemsByCat, providerCategories }) {
  return useMenuFiltering({ providerItemsByCat, providerCategories });
}
