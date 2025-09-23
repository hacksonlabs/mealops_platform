// src/hooks/restaurant-details/useEditModal.js
import { useEffect, useMemo, useState, useCallback } from 'react';

const isExtraName = (value) => /^(extra|extras)$/i.test(String(value || '').trim());

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
    let hasExplicitExtras = false;
    let members = [];
    let extrasArray = [];
    let extrasCount = 0;
    if (asg) {
      members = Array.isArray(asg.member_ids) ? asg.member_ids.map((id) => ({ id })) : [];

      extrasArray = Array.isArray(asg.extras) ? asg.extras : [];
      extrasCount = Number(asg.extra_count ?? asg.extras_count ?? extrasArray.length ?? 0) || 0;
      hasExplicitExtras =
        extrasArray.length > 0 ||
        (Array.isArray(asg.display_names) && asg.display_names.some(isExtraName));

      const extras = hasExplicitExtras
        ? Array.from({ length: Math.max(extrasCount, extrasArray.length) }, () => ({ id: EXTRA_SENTINEL, name: 'Extra' }))
        : [];

      const combined = [...members, ...extras];
      assignedTo = combined.length ? combined : null;
    }

    if (!assignedTo || assignedTo.length === 0) {
      assignedTo = editState.assignedTo || (editState.userName ? [{ name: editState.userName }] : null);
    }

    if (Array.isArray(assignedTo) && assignedTo.length) {
      const onlyExtras = assignedTo.every((a) => {
        const nm = typeof a === 'string' ? a : a?.name;
        const id = typeof a === 'object' ? a?.id : null;
        return id === EXTRA_SENTINEL || isExtraName(nm);
      });
      if (onlyExtras && !hasExplicitExtras) {
        assignedTo = null;
      }
    }

    const sanitizedSelectedOptions = (() => {
      if (!editState.selectedOptions || typeof editState.selectedOptions !== 'object') return null;
      const next = { ...editState.selectedOptions };
      if (next.__assignment__) {
        const assign = { ...next.__assignment__ };
        assign.member_ids = Array.isArray(assign.member_ids) ? assign.member_ids : [];
        if (hasExplicitExtras) {
          assign.extra_count = extrasCount;
          assign.extras_count = extrasCount;
          assign.extras = extrasArray;
        } else {
          if (assign.extra_count) assign.extra_count = 0;
          if (assign.extras_count) assign.extras_count = 0;
          if (assign.extras) delete assign.extras;
          if (Array.isArray(assign.display_names)) {
            assign.display_names = assign.display_names.filter((nm) => !isExtraName(nm));
            if (!assign.display_names.length) delete assign.display_names;
          }
        }
        next.__assignment__ = assign;
      }
      return next;
    })();

    return {
      quantity: Number(editState.quantity || 1),
      selectedOptions: sanitizedSelectedOptions,
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
