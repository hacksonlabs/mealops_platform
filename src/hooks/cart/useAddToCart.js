// src/hooks/cart/useAddToCart.js

import React, { useCallback } from 'react';
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
  const handleAddToCart = useCallback(async (customizedItem, quantity = 1) => {
    const {
      cartRowId,
      id,
      name,
      image,
      price,
      selectedOptions,
      selectedSize,
      selectedToppings,
      specialInstructions,
      customizedPrice,
      assignedTo,
      optionsCatalog,
      addedByMemberId,
    } = customizedItem || {};

    // derive price and assignment
   const unitPrice = pickUnitPrice(customizedItem);
   const memberIds = assignedTo
     .map(a => a?.id)
     .filter(v => v && v !== EXTRA_SENTINEL);
   const displayNames = assignedTo
     .map(a => a?.name)
     .filter(Boolean);
   const extraCount = assignedTo.filter(a => a?.id === EXTRA_SENTINEL).length;

   // also tuck assignment into selectedOptions.__assignment__ for snapshotting
   const selectedWithAssignment = {
     ...(selectedOptions || {}),
     __assignment__: {
       member_ids: memberIds,
       extra_count: extraCount,
       display_names: displayNames,
     },
   };

    if (cartRowId) {
     // update existing row (and replace assignees rows)
     await cartDbService.updateItemFull(cartId, cartRowId, {
       quantity,
       unitPrice,
       specialInstructions,
       selectedOptions: selectedWithAssignment,
       assignment: { memberIds, extraCount },
     });
   } else {
     // insert new
     await cartDbService.addItem(cartId, {
       menuItem: { id, name, image },
       quantity,
       unitPrice,
       specialInstructions,
       selectedOptions: selectedWithAssignment,
       assignment: { memberIds, displayNames, extraCount },
       addedByMemberId,
     });
   }

    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartId } }));
  }, [cartId]);


  return { handleAddToCart };
}
