// src/hooks/cart/useItemEditModal.js
import { useEditModal } from '@/hooks/restaurant-details';
import { EXTRA_SENTINEL } from './constants';

export default function useItemEditModal({ location }) {
  return useEditModal({ location, menuRaw: null, EXTRA_SENTINEL });
}
