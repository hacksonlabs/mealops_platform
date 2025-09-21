// src/hooks/restaurant-details/useEditModal.js
import { useEffect, useMemo, useState, useCallback } from 'react';

export default function useEditModal({ location, menuRaw, EXTRA_SENTINEL }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  const editState = location.state?.editItem || null;

  const presetForSelected = useMemo(() => {
    if (!selectedItem || !editState) return undefined;

    const editedMenuItemId = editState.menuItemId || editState.menu_items?.id || editState.id;
    if (editedMenuItemId !== selectedItem.id) return undefined;

    let assignedTo = null;
    const asg = editState.selectedOptions?.__assignment__ || null;
    if (asg) {
      const members = Array.isArray(asg.member_ids) ? asg.member_ids.map((id) => ({ id })) : [];
      const extras = Array.from({ length: Number(asg.extra_count || 0) }, () => ({ id: EXTRA_SENTINEL, name: 'Extra' }));
      assignedTo = [...members, ...extras];
    }
    if (!assignedTo || assignedTo.length === 0) {
      assignedTo = editState.assignedTo || (editState.userName ? [{ name: editState.userName }] : null);
    }

    return {
      quantity: Number(editState.quantity || 1),
      selectedOptions: editState.selectedOptions ?? null,
      selectedToppings: editState.selectedToppings ?? null,
      selectedSize: editState.selectedSize ?? null,
      specialInstructions: editState.specialInstructions || '',
      assignedTo,
      cartRowId: editState.rowId || editState.id || null,
      cartId: location.state?.cartId || null,
      menuItemId: editedMenuItemId,
    };
  }, [selectedItem, editState, location.state?.cartId, EXTRA_SENTINEL]);

  // open from Edit navigation
  useEffect(() => {
    const edit = location.state?.editItem;
    if (!edit || !menuRaw?.length) return;
    const menuItemId = edit.menuItemId || edit.id;
    const row = menuRaw.find((r) => r.id === menuItemId);
    if (!row) return;

    const mapped = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: row.price ?? 0,
      image: row.image_url || '',
      sizes: row.sizes_json || [],
      toppings: row.toppings_json || [],
      options: row.options_json || null,
      category: row.category || 'Menu',
    };

    setSelectedItem(mapped);
    setIsOpen(true);
    window.dispatchEvent(new Event('closeCartDrawer'));
  }, [location.state?.editItem, menuRaw]);

  const openForItem = useCallback((item) => {
    setSelectedItem(item);
    setIsOpen(true);
    window.dispatchEvent(new Event('closeCartDrawer'));
    window.dispatchEvent(new Event('closeCartHub'));
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    setSelectedItem(null);
    // clear edit state so modal doesn't keep showing "Save changes"
    if (location.state?.editItem) {
      history.replaceState({}, '');
    }
  }, [location.state?.editItem]);

  return { selectedItem, isOpen, openForItem, closeModal, presetForSelected };
}