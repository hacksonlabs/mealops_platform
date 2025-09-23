// src/hooks/cart/useCartOnPage.js
import { useEffect, useState } from 'react';

const toArray = (value) => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const normalizePriceCents = (value) => {
  const cents = Number(value);
  if (Number.isFinite(cents)) return Math.round(cents);
  return 0;
};

const buildSelectedOptionsPayload = (selections = {}, catalog = []) => {
  if (selections && typeof selections === 'object' && selections.__meta__) {
    const cloned = {};
    Object.entries(selections).forEach(([key, value]) => {
      if (key.startsWith('__')) return;
      cloned[key] = toArray(value).map((entry) =>
        typeof entry === 'object' && entry !== null ? { ...entry } : entry
      );
    });
    cloned.__meta__ = selections.__meta__;
    return cloned;
  }

  const payload = {};
  if (Array.isArray(selections)) {
    payload.__root__ = selections.map((entry) =>
      typeof entry === 'object' && entry !== null ? { ...entry } : entry
    );
  } else if (selections && typeof selections === 'object') {
    Object.entries(selections).forEach(([key, value]) => {
      if (key.startsWith('__')) return;
      payload[key] = toArray(value).map((entry) =>
        typeof entry === 'object' && entry !== null ? { ...entry } : entry
      );
    });
  }

  const meta = {};
  const groupMap = new Map();
  (Array.isArray(catalog) ? catalog : []).forEach((group) => {
    if (!group) return;
    const key = group.id ?? group.name;
    if (!key) return;
    groupMap.set(String(key), group);
  });

  const toRecord = (group, raw) => {
    const rawObj = typeof raw === 'object' && raw !== null ? raw : {};
    const candidateId = rawObj.id ?? rawObj.optionId ?? rawObj.value ?? (typeof raw === 'string' ? raw : null);
    const option = group?.options?.find((opt) => {
      const optId = opt?.id ?? opt?.value ?? opt?.optionId ?? null;
      return optId != null && String(optId) === String(candidateId);
    });

    const name =
      option?.name ??
      option?.label ??
      rawObj.name ??
      rawObj.label ??
      (typeof candidateId === 'string' ? candidateId : 'Option');

    const priceCents = (() => {
      if (Number.isFinite(Number(option?.price_cents))) return Math.round(Number(option.price_cents));
      if (Number.isFinite(Number(option?.price))) return Math.round(Number(option.price) * 100);
      if (Number.isFinite(Number(rawObj.price_cents))) return Math.round(Number(rawObj.price_cents));
      if (Number.isFinite(Number(rawObj.price))) return Math.round(Number(rawObj.price) * 100);
      return 0;
    })();

    const quantity = (() => {
      if (Number.isFinite(Number(option?.quantity))) return Math.max(1, Math.round(Number(option.quantity)));
      if (Number.isFinite(Number(rawObj.quantity))) return Math.max(1, Math.round(Number(rawObj.quantity)));
      return 1;
    })();

    return {
      id: candidateId != null ? String(candidateId) : null,
      name,
      price: priceCents / 100,
      price_cents: priceCents,
      quantity,
    };
  };

  Object.entries({ ...payload }).forEach(([key, rawValues]) => {
    if (key.startsWith('__')) return;
    const group = groupMap.get(key) || null;
    const processed = Array.isArray(rawValues)
      ? rawValues.map((entry) => toRecord(group, entry)).filter(Boolean)
      : [];

    if (processed.length) {
      payload[key] = processed;
      meta[key] = {
        id: group?.id ?? key,
        name: group?.name ?? key,
        options: processed.map((opt) => ({
          optionId: opt.id,
          name: opt.name,
          priceCents: normalizePriceCents(opt.price_cents),
          quantity: opt.quantity,
        })),
      };
    }
  });

  if (Object.keys(meta).length) payload.__meta__ = meta;

  return payload;
};

export default function useCartOnPage({
  activeTeam, restaurant, provider, fulfillment,
  setProvider, setActiveCartId, location,
  cartDbService, EXTRA_SENTINEL,
  initialCartTitle, mealType
}) {
  const [cartId, setCartId] = useState(null);

  // If coming from Hub, hydrate (and optionally open)
  useEffect(() => {
    const incoming = location.state?.cartId;
    const openCartOnLoad = location.state?.openCartOnLoad === true;
    if (!incoming) return;

    setCartId(incoming);
    setActiveCartId?.(incoming);

    (async () => {
      const snap = await cartDbService.getCartSnapshot(incoming);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.cart?.title?.trim() ? `${snap.cart.title} • Cart` : (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
          cartId: incoming,
          restaurant: snap.restaurant,
          items: snap.items,
          fulfillment: location.state?.fulfillment || fulfillment,
        },
      }));
      if (openCartOnLoad) window.dispatchEvent(new Event('openCartDrawer'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.cartId, location.state?.openCartOnLoad]);

  // Lookup an existing cart for this restaurant/provider if not supplied
  useEffect(() => {
    if (!activeTeam?.id || !restaurant?.id) return;
    if (location.state?.cartId) return;
    let cancelled = false;
    (async () => {
      const id = await cartDbService.findActiveCartForRestaurant(activeTeam.id, restaurant.id, provider, fulfillment, mealType);
      if (!id || cancelled) return;
      setCartId(id);
      const snap = await cartDbService.getCartSnapshot(id);
      if (!snap || cancelled) return;
      // Set title if we have an initial title and the cart has none or just the fallback
      const desired = initialCartTitle?.trim();
      if (desired && (!snap.cart?.title || snap.cart.title === snap.restaurant?.name)) {
        try {
          await cartDbService.updateCartTitle(id, desired);
          snap.cart.title = desired;
        } catch (e) {
          console.warn('Could not set existing cart title:', e);
        }
      }
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.cart?.title?.trim() ? `${snap.cart.title} • Cart` : (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
          fulfillment,
        },
      }));
    })();
    return () => { cancelled = true; };
  }, [activeTeam?.id, restaurant?.id, provider, location.state?.cartId]);

  // Subscribe realtime to keep drawer fresh
  useEffect(() => {
    if (!cartId) return;
    const unsubscribe = cartDbService.subscribeToCart(cartId, async () => {
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.cart?.title?.trim() ? `${snap.cart.title} • Cart` : (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    });
    return unsubscribe;
  }, [cartId]);

  // Drawer "Remove"
  useEffect(() => {
    const onRemove = async (e) => {
      const { cartId: evtCartId, itemId } = e?.detail || {};
      if (!itemId || !evtCartId || evtCartId !== cartId) return;
      await cartDbService.removeItem(cartId, itemId);
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.cart?.title?.trim() ? `${snap.cart.title} • Cart` : (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    };
    window.addEventListener('cartItemRemove', onRemove);
    return () => window.removeEventListener('cartItemRemove', onRemove);
  }, [cartId]);

  // Add/Update item
  const handleAddToCart = async (customizedItem, quantity) => {
    let id = cartId;

    if (!id) {
      if (!activeTeam?.id || !restaurant?.id) return;
      id = await cartDbService.ensureCartForRestaurant(
        activeTeam.id, restaurant.id,
        {
          title: (initialCartTitle && initialCartTitle.trim())
            ? initialCartTitle.trim()
            : `${restaurant.name}`,
          providerType: provider,
          providerRestaurantId: restaurant?.provider_restaurant_ids?.[provider] || null,
          fulfillment,
          mealType,
        }
      );
      await cartDbService.upsertCartFulfillment(id, fulfillment, {
        providerType: provider,
        providerRestaurantId: restaurant?.provider_restaurant_ids?.[provider] || null,
      });
      setCartId(id);
      setProvider(provider);
    }

    const selectedOptionsPayload = buildSelectedOptionsPayload(
      customizedItem.selectedOptions,
      customizedItem.optionsCatalog
    );

    const descriptors = [];
    (customizedItem.assignedTo || []).forEach((entry) => {
      if (!entry) return;
      const id = entry.id;
      const name = entry.name || entry.full_name || '';
      if (id === EXTRA_SENTINEL || (typeof name === 'string' && /^(extra|extras)$/i.test(name))) {
        descriptors.push({ type: 'extra' });
      } else if (id) {
        descriptors.push({ type: 'member', id, name });
      }
    });

    const qtyNumber = Math.max(1, Number(quantity || 1));
    const existingCount = descriptors.length;
    const remaining = Math.max(0, qtyNumber - existingCount);
    for (let i = 0; i < remaining; i++) descriptors.push({ type: 'unassigned' });

    if (descriptors.length === 0) descriptors.push({ type: 'unassigned' });

    const baseOptions = { ...selectedOptionsPayload };
    delete baseOptions.__assignment__;

    if (customizedItem.cartRowId) {
      try {
        await cartDbService.removeItem(id, customizedItem.cartRowId);
      } catch (err) {
        console.error('[useCartOnPage] failed to remove original row', err);
      }
    }

    const unitPrice = typeof customizedItem.customizedPrice === 'number'
      ? customizedItem.customizedPrice
      : Number(customizedItem.price || 0);

    for (const desc of descriptors) {
      const assignment = {
        memberIds: [],
        displayNames: [],
        extraCount: 0,
        unitsByMember: {},
      };

      if (desc.type === 'member') {
        assignment.memberIds = [desc.id];
        assignment.displayNames = desc.name ? [desc.name] : [];
        assignment.unitsByMember = { [desc.id]: 1 };
      } else if (desc.type === 'extra') {
        assignment.extraCount = 1;
        assignment.displayNames = ['Extra'];
      }

      const selectedForUnit = {
        ...JSON.parse(JSON.stringify(baseOptions)),
        __assignment__: {
          member_ids: assignment.memberIds,
          extra_count: assignment.extraCount,
          display_names: assignment.displayNames,
        },
      };

      await cartDbService.addItem(id, {
        menuItem: { id: customizedItem.id, name: customizedItem.name, image: customizedItem.image },
        quantity: 1,
        unitPrice,
        specialInstructions: customizedItem.specialInstructions || '',
        selectedOptions: selectedForUnit,
        assignment,
        addedByMemberId: customizedItem.addedByMemberId,
      });
    }

    const snap = await cartDbService.getCartSnapshot(id);
    if (snap) {
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count, total,
          name: snap.cart?.title?.trim() ? `${snap.cart.title} • Cart` : (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
          cartId: id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    }
  };

  return { cartId, handleAddToCart };
}
