// src/hooks/cart/useAddToCart.js
import cartDbService from '@/services/cartDBService';
import { EXTRA_SENTINEL } from './constants';

const moneyToNumber = (v) => {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(String(v).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const pickUnitPrice = (it = {}) => {
  const a = moneyToNumber(it.customizedPrice);
  if (a != null) return a;

  const b = moneyToNumber(it.unitPrice ?? it.price ?? it?.pricing?.price);
  if (b != null) return b;

  const cents =
    it.price_cents ?? it.priceCents ?? it?.pricing?.price_cents ?? it?.pricing?.priceCents;
  if (Number.isFinite(Number(cents))) return Number(cents) / 100;

  return 0;
};

export default function useAddToCart(cartId) {
  const handleAddToCart = async (customizedItem, quantity = 1) => {
    if (!cartId) return;

    const memberIds   = (customizedItem.assignedTo || []).map(a => a?.id).filter(Boolean);
    const extraCount  = (customizedItem.assignedTo || [])
      .filter(a => a?.name === 'Extra' || a?.id === EXTRA_SENTINEL).length;
    const displayNames = (customizedItem.assignedTo || []).map(a => a?.name).filter(Boolean);

    const unitPrice = pickUnitPrice(customizedItem);
    const selectedOptions = customizedItem.selectedOptions || '';

    if (customizedItem.cartRowId) {
      const selWithAssign = {
        ...selectedOptions,
        __assignment__: { member_ids: memberIds, extra_count: extraCount, display_names: displayNames },
      };
      await cartDbService.updateItem(cartId, customizedItem.cartRowId, {
        quantity,
        price: unitPrice,
        special_instructions: customizedItem.specialInstructions || '',
        selected_options: selWithAssign,
      });
    } else {
      await cartDbService.addItem(cartId, {
        menuItem: { id: customizedItem.id, name: customizedItem.name },
        quantity,
        unitPrice,
        specialInstructions: customizedItem.specialInstructions || '',
        selectedOptions,
        assignment: { memberIds, extraCount, displayNames },
      });
    }
  };

  return { handleAddToCart };
}
