import { useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeOptionGroups,
  findOptionIdByAny,
  computeUnitPrice,
  slug,
} from '../../utils/sharedCartCustomizationUtils';

export default function useItemSelections({ isOpen, item, preset }) {
  const [selections, setSelections] = useState({});
  const hydratedRef = useRef(false);

  // Build normalized groups from menu item
  const groups = useMemo(() => normalizeOptionGroups(item || {}), [item]);

  // Handy lookups
  const sizeGroup = useMemo(() => (
    groups.find((g) => g.id === 'size') ||
    groups.find((g) => g.pricingMode === 'absolute') ||
    groups.find((g) => /size/i.test(g.name || ''))
  ), [groups]);

  const toppingsGroup = useMemo(() => (
    groups.find((g) => g.id === 'toppings') ||
    groups.find((g) => /topping/i.test(g.name || ''))
  ), [groups]);

  // Reset on open or item change
  useEffect(() => {
    if (!isOpen) return;
    hydratedRef.current = false;
    setSelections({});
  }, [isOpen, item]);

  // Default required single groups
  useEffect(() => {
    if (!isOpen) return;
    setSelections((prev) => {
      const next = { ...prev };
      groups.forEach((g) => {
        if (g.required && g.type === 'single' && !(next[g.id]?.length)) {
          const first = g.options?.[0]?.id;
          if (first) next[g.id] = [first];
        }
      });
      return next;
    });
  }, [isOpen, groups]);

  // Hydrate from preset once per open
  useEffect(() => {
    if (!isOpen || hydratedRef.current) return;
    if (!preset) return;
    hydratedRef.current = true;

    const nextSel = {};
    if (preset.selectedOptions && typeof preset.selectedOptions === 'object' && !Array.isArray(preset.selectedOptions)) {
      for (const [key, valsMaybe] of Object.entries(preset.selectedOptions)) {
        const g =
          groups.find((gg) => gg.id === key) ||
          groups.find((gg) => gg.name?.toLowerCase() === key.toLowerCase()) ||
          groups.find((gg) => slug(gg.name) === key);
        if (!g) continue;
        const vals = Array.isArray(valsMaybe) ? valsMaybe : [valsMaybe];
        const ids = vals.map((v) => findOptionIdByAny(g, v)).filter(Boolean);
        if (ids.length) nextSel[g.id] = ids;
      }
    } else if (Array.isArray(preset.selectedOptions)) {
      for (const g of groups) {
        const ids = preset.selectedOptions.map((v) => findOptionIdByAny(g, v)).filter(Boolean);
        if (ids.length) nextSel[g.id] = ids;
      }
    }

    if (sizeGroup && preset.selectedSize) {
      const id = findOptionIdByAny(sizeGroup, preset.selectedSize);
      if (id) nextSel[sizeGroup.id] = [id];
    }

    if (toppingsGroup && Array.isArray(preset.selectedToppings)) {
      const ids = preset.selectedToppings.map((v) => findOptionIdByAny(toppingsGroup, v)).filter(Boolean);
      if (ids.length) nextSel[toppingsGroup.id] = ids;
    }

    setSelections((prev) => ({ ...prev, ...nextSel }));
  }, [isOpen, preset, groups, sizeGroup, toppingsGroup]);

  const unitPrice = useMemo(
    () => computeUnitPrice(item?.price, groups, selections),
    [item?.price, groups, selections]
  );

  const missingRequired = useMemo(
    () => groups.some((g) => g.required && ((selections[g.id]?.length || 0) < (g.min ?? 1))),
    [groups, selections]
  );

  return {
    groups,
    sizeGroup,
    toppingsGroup,
    selections,
    setSelections,
    unitPrice,
    missingRequired,
  };
}