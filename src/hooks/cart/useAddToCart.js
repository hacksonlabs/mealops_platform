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

const isExtraName = (nm) => /^(extra|extras)$/i.test(String(nm || '').trim());

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

    const unitPrice = pickUnitPrice(customizedItem);

    const descriptors = [];
    if (Array.isArray(assignedTo)) {
      assignedTo.forEach((entry) => {
        if (!entry) return;
        const id = entry.id;
        const name = entry.name || entry.full_name || '';
        if (id === EXTRA_SENTINEL || isExtraName(name)) {
          descriptors.push({ type: 'extra' });
        } else if (id) {
          descriptors.push({ type: 'member', id, name });
        }
      });
    }

    const qtyNumber = Math.max(1, Number(quantity || 1));
    const existingCount = descriptors.length;
    const remaining = Math.max(0, qtyNumber - existingCount);

    for (let i = 0; i < remaining; i++) {
      descriptors.push({ type: 'unassigned' });
    }

    if (descriptors.length === 0) {
      descriptors.push({ type: 'unassigned' });
    }

    const baseOptions = { ...(selectedOptions || {}) };
    delete baseOptions.__assignment__;

    for (const desc of descriptors) {
      const assignment = {
        memberIds: [],
        displayNames: [],
        extraCount: 0,
        unitsByMember: {},
      };
      const perAssigned = [];

      if (desc.type === 'member') {
        assignment.memberIds = [desc.id];
        assignment.displayNames = desc.name ? [desc.name] : [];
        assignment.unitsByMember = { [desc.id]: 1 };
        perAssigned.push({ id: desc.id, name: desc.name });
      } else if (desc.type === 'extra') {
        assignment.extraCount = 1;
        assignment.displayNames = ['Extra'];
        perAssigned.push({ id: EXTRA_SENTINEL, name: 'Extra' });
      }

      const selectedForUnit = {
        ...JSON.parse(JSON.stringify(baseOptions)),
        __assignment__: {
          member_ids: assignment.memberIds,
          extra_count: assignment.extraCount,
          display_names: assignment.displayNames,
        },
      };

      await cartDbService.addItem(cartId, {
        menuItem: { id, name, image },
        quantity: 1,
        unitPrice,
        specialInstructions,
        selectedOptions: selectedForUnit,
        assignment,
        addedByMemberId,
        assignedTo: perAssigned,
      });
    }

    window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartId } }));
  }, [cartId]);


  return { handleAddToCart };
}
