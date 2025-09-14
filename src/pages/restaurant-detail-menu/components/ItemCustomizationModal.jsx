import React, { useEffect, useMemo, useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import { useAuth } from '../../../contexts';
import { supabase } from '../../../lib/supabase';

const EXTRA_SENTINEL = '__EXTRA__'; // guaranteed not to collide with UUIDs

const slug = (s='') =>
  String(s).toLowerCase().replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');

// Basic heuristics so common groups “just work”
function inferGroupMetaFromName(name) {
  const n = (name || '').toLowerCase();
  if (n === 'size' || n === 'sizes') {
    return { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' };
  }
  if (n === 'topping' || n === 'toppings') {
    return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
  }
  if (/(bun|bread|tortilla|base|protein|rice|sauce|dressing)/i.test(n)) {
    return { type: 'single', required: false, min: 0, max: 1, pricingMode: 'additive' };
  }
  return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
}

// Build ONE groups array from item.options + item.sizes + item.toppings
function normalizeOptionGroups(item) {
  const groups = [];
  const pushGroup = (id, name, meta, list=[]) => {
    const m = meta || inferGroupMetaFromName(name);
    groups.push({
      id: id || slug(name),
      name,
      type: m.type,
      required: !!m.required,
      min: m.min ?? (m.required ? 1 : 0),
      max: m.max ?? (m.type === 'single' ? 1 : Infinity),
      pricingMode: m.pricingMode || 'additive', // 'absolute' overrides base price, 'additive' adds to it
      options: (list || []).map((o, i) => ({
        id: o.id || slug(o.name || `opt-${i}`),
        name: o.name || `Option ${i+1}`,
        description: o.description || '',
        price: Number(o.price || 0),
      })),
    });
  };

  // 1) sizes array -> Size group (absolute price, single, required)
  if (Array.isArray(item?.sizes) && item.sizes.length) {
    pushGroup('size', 'Size',
      { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' },
      item.sizes
    );
  }

  // 2) toppings array -> Toppings group (additive multi)
  if (Array.isArray(item?.toppings) && item.toppings.length) {
    pushGroup('toppings', 'Toppings',
      { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' },
      item.toppings
    );
  }

  // 3) options_json (many shapes)
  const raw = item?.options;
  if (Array.isArray(raw)) {
    // Either: [{name, options:[...]}] OR a flat list of options
    if (raw[0]?.options) {
      raw.forEach((g, i) => {
        const meta = g.type
          ? { type: g.type, required: !!g.required, min: g.min, max: g.max, pricingMode: g.pricingMode }
          : inferGroupMetaFromName(g.name);
        pushGroup(g.id || slug(g.name || `group-${i}`), g.name || `Options ${i+1}`, meta, g.options);
      });
    } else {
      // Flat list -> one multi group
      pushGroup('options', 'Options',
        { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' },
        raw
      );
    }
  } else if (raw && typeof raw === 'object') {
    // { groupName: [ {name, price?} ] }
    Object.entries(raw).forEach(([groupName, arr], gi) => {
      if (!Array.isArray(arr)) return;
      // Avoid duplicating if sizes/toppings already added above
      if (/^sizes?$/.test(groupName) && item?.sizes?.length) return;
      if (/^toppings?$/.test(groupName) && item?.toppings?.length) return;
      const meta = inferGroupMetaFromName(groupName);
      pushGroup(slug(groupName || `group-${gi}`), groupName || `Options ${gi+1}`, meta, arr);
    });
  }

  // Ensure Size (if present) renders first
  groups.sort((a, b) => {
    const aAbs = a.pricingMode === 'absolute' ? 1 : 0;
    const bAbs = b.pricingMode === 'absolute' ? 1 : 0;
    return bAbs - aAbs;
  });
  return groups;
}

function findOptionIdByAny(group, val) {
  const vId = typeof val === 'object' ? val?.id : undefined;
  const vName = typeof val === 'object' ? val?.name : (typeof val === 'string' ? val : undefined);
  const byId = vId && group.options.find(o => o.id === vId);
  if (byId) return byId.id;
  const byName = vName && group.options.find(o => o.name?.toLowerCase() === String(vName).toLowerCase());
  if (byName) return byName.id;
  if (typeof val === 'string') {
    const direct = group.options.find(o => o.id === val);
    if (direct) return direct.id;
  }
  return null;
}

function extractMemberIdsFromPreset(assignedTo, members) {
  if (!assignedTo || !Array.isArray(assignedTo)) return [];
  const ids = [];
  assignedTo.forEach(a => {
    if (typeof a === 'string') {
      const s = a.trim().toLowerCase();
      if (s === 'extra') {
        ids.push(EXTRA_SENTINEL);
        return;
      }
      const m = members.find(mm => (mm.full_name || '').toLowerCase() === s);
      if (m) ids.push(m.id);
      return;
    }
    if (a && typeof a === 'object') {
      const nm = (a.name || a.full_name || '').trim().toLowerCase();
      if (nm === 'extra') {
        ids.push(EXTRA_SENTINEL);
        return;
      }
      if (a.id) {
        ids.push(a.id);
        return;
      }
      const m = members.find(mm => (mm.full_name || '').toLowerCase() === nm);
      if (m) ids.push(m.id);
    }
  });
  return ids;
}

const ItemCustomizationModal = ({ item, isOpen, onClose, onAddToCart, preset }) => {
  const { activeTeam } = useAuth();
  const isEditing = !!preset?.cartRowId;

  // Assignment
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]); // [{id, full_name, email, role, phone_number}]
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [assigneesLocked, setAssigneesLocked] = useState(false);
  const [memberQuery, setMemberQuery] = useState('');

  // Quantity & generic selections
  const [quantity, setQuantity] = useState(1);
  const groups = useMemo(() => normalizeOptionGroups(item || {}), [item]);
  const [selections, setSelections] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState('');

  const hydratedRef = useRef(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Reset on open/change
  useEffect(() => {
    if (!isOpen) return;
    hydratedRef.current = false;
    setQuantity(1);
    setSelections({});
    setSpecialInstructions('');
    setAssigneeIds([]);
    setAssigneesLocked(false);
    setMemberQuery('');
  }, [isOpen, item]);

  // Default-select required SINGLE groups (e.g., Size) on open
  useEffect(() => {
    if (!isOpen) return;
    setSelections(prev => {
      const next = { ...prev };
      groups.forEach(g => {
        const chosen = next[g.id] || [];
        if (g.required && g.type === 'single' && chosen.length === 0) {
          const first = g.options?.[0]?.id;
          if (first) next[g.id] = [first];
        }
      });
      return next;
    });
  }, [isOpen, groups]);

  // Trim assignees when quantity decreases
  useEffect(() => {
    setAssigneeIds((prev) => prev.slice(0, quantity));
  }, [quantity]);

  // Load team members
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!isOpen || !activeTeam?.id) {
        setMembers([]);
        return;
      }
      setMembersLoading(true);
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, full_name, email, role, phone_number')
          .eq('team_id', activeTeam.id)
          .order('full_name', { ascending: true });

        if (error) throw error;
        if (!cancel) setMembers(data || []);
      } catch (e) {
        if (!cancel) setMembers([]);
        console.warn('Failed to load team members', e);
      } finally {
        if (!cancel) setMembersLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [isOpen, activeTeam?.id]);

  // Price: base = item.price; absolute groups override base; others add up
  const unitPrice = useMemo(() => {
    let base = Number(item?.price || 0);
    let add = 0;
    for (const g of groups) {
      const chosen = selections[g.id] || [];
      if (g.pricingMode === 'absolute') {
        const id = chosen[0];
        const opt = g.options.find(o => o.id === id);
        if (opt) base = Number(opt.price || base);
      } else {
        for (const id of chosen) {
          const opt = g.options.find(o => o.id === id);
          if (opt) add += Number(opt.price || 0);
        }
      }
    }
    return base + add;
  }, [item?.price, groups, selections]);

  const total = unitPrice * quantity;

  // Required check purely from groups now
  const missingRequired = useMemo(() => {
    return groups.some(g => g.required && ((selections[g.id]?.length || 0) < (g.min ?? 1)));
  }, [groups, selections]);

  // ---- HYDRATE FROM PRESET (once per open) ----
  useEffect(() => {
    if (!isOpen || hydratedRef.current) return;
    if (!preset) return;
    hydratedRef.current = true;

    if (typeof preset.quantity === 'number') setQuantity(Math.max(1, preset.quantity));
    if (typeof preset.specialInstructions === 'string') setSpecialInstructions(preset.specialInstructions);

    const nextSel = {};

    // 1) Generic selectedOptions (object{groupKey -> val/val[]}, or array)
    if (preset.selectedOptions) {
      if (!Array.isArray(preset.selectedOptions) && typeof preset.selectedOptions === 'object') {
        for (const [key, valsMaybe] of Object.entries(preset.selectedOptions)) {
          const g =
            groups.find(gg => gg.id === key) ||
            groups.find(gg => gg.name?.toLowerCase() === key.toLowerCase()) ||
            groups.find(gg => slug(gg.name) === key);
          if (!g) continue;
          const vals = Array.isArray(valsMaybe) ? valsMaybe : [valsMaybe];
          const ids = [];
          vals.forEach(v => {
            const id = findOptionIdByAny(g, v);
            if (id) ids.push(id);
          });
          if (ids.length) nextSel[g.id] = ids;
        }
      } else if (Array.isArray(preset.selectedOptions)) {
        for (const g of groups) {
          const ids = [];
          preset.selectedOptions.forEach(v => {
            const id = findOptionIdByAny(g, v);
            if (id) ids.push(id);
          });
          if (ids.length) nextSel[g.id] = ids;
        }
      }
    }

    // 2) Legacy fields: selectedSize / selectedToppings -> map into groups
    const sizeGroup =
      groups.find(gg => gg.id === 'size') ||
      groups.find(gg => gg.pricingMode === 'absolute') ||
      groups.find(gg => /size/i.test(gg.name || ''));

    if (sizeGroup && preset.selectedSize) {
      const id = findOptionIdByAny(sizeGroup, preset.selectedSize);
      if (id) nextSel[sizeGroup.id] = [id];
    }

    const toppingsGroup = groups.find(gg => gg.id === 'toppings') || groups.find(gg => /topping/i.test(gg.name || ''));
    if (toppingsGroup && Array.isArray(preset.selectedToppings)) {
      const ids = [];
      preset.selectedToppings.forEach(v => {
        const id = findOptionIdByAny(toppingsGroup, v);
        if (id) ids.push(id);
      });
      if (ids.length) nextSel[toppingsGroup.id] = ids;
    }

    setSelections(prev => ({ ...prev, ...nextSel }));

    // 3) Assignees (same as before)
    let ids = [];
    if (preset.assignedTo && Array.isArray(preset.assignedTo)) {
      ids = extractMemberIdsFromPreset(preset.assignedTo, members);
    }
    // fallback: read ids directly from selectedOptions.__assignment__
    if (!ids.length) {
      const asg = preset.selectedOptions?.__assignment__;
      if (asg) {
        ids = [
          ...(Array.isArray(asg.member_ids) ? asg.member_ids : []),
          ...Array.from({ length: Number(asg.extra_count || 0) }, () => EXTRA_SENTINEL),
        ];
      }
    }
    if (ids.length) {
      setAssigneeIds(ids.slice(0, Math.max(1, preset.quantity || 1)));
      setAssigneesLocked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preset, groups]);

  // If members load after hydration, try mapping assignees again
  useEffect(() => {
    if (!isOpen || !preset?.assignedTo) return;
    if (!members?.length) return;
    if (assigneeIds?.length) return;
    if (assigneesLocked) return;
    const ids = extractMemberIdsFromPreset(preset.assignedTo, members);
    if (ids.length) {
      setAssigneeIds(ids.slice(0, quantity));
      setAssigneesLocked(true);
    }
  }, [isOpen, preset?.assignedTo, members, assigneeIds?.length, quantity, assigneesLocked]);

  const toggleOption = (group, optId) => {
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (group.type === 'single') {
        return { ...prev, [group.id]: [optId] };
      }
      const set = new Set(current);
      if (set.has(optId)) set.delete(optId);
      else {
        if (group.max !== Infinity && set.size >= group.max) return prev;
        set.add(optId);
      }
      return { ...prev, [group.id]: Array.from(set) };
    });
  };

  // Build options including a hidden search string
  const optionsList = useMemo(() => {
    const base = [{ value: EXTRA_SENTINEL, label: 'Extra', search: 'extra' }];
    return base.concat(
      (members || []).map(m => ({
        value: m.id,
        label: m.full_name || m.email || 'Unnamed',
        search: `${m.full_name || ''}`.toLowerCase(),
      }))
    );
  }, [members]);

  // 🔎 Filter options by search query (case-insensitive, matches all tokens)
  const filteredOptionsList = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return optionsList;
    const tokens = q.split(/\s+/);
    return optionsList.filter(opt => {
      const hay = (opt.search || opt.label.toLowerCase());
      return tokens.every(t => hay.includes(t));
    });
  }, [optionsList, memberQuery]);

  const handleAdd = () => {
    if (missingRequired) return;

    const assigned = assigneeIds
      .map(id => {
        if (id === EXTRA_SENTINEL) {
          return { id: EXTRA_SENTINEL, name: 'Extra', role: null, email: null, phone: null };
        }
        const m = members.find(mm => mm.id === id);
        return m
          ? { id: m.id, name: m.full_name, role: m.role, email: m.email, phone: m.phone_number || null }
          : null;
      })
      .filter(Boolean);

    // Derive legacy fields from groups for back-compat
    const sizeGroup =
      groups.find(gg => gg.id === 'size') ||
      groups.find(gg => gg.pricingMode === 'absolute') ||
      groups.find(gg => /size/i.test(gg.name || ''));
    const selectedSizeId = sizeGroup ? (selections[sizeGroup.id] || [])[0] : null;
    const selectedSize = selectedSizeId ? sizeGroup.options.find(o => o.id === selectedSizeId) : null;

    const toppingsGroup = groups.find(gg => gg.id === 'toppings') || groups.find(gg => /topping/i.test(gg.name || ''));
    const selectedToppings = (toppingsGroup ? (selections[toppingsGroup.id] || []) : [])
      .map(id => toppingsGroup.options.find(o => o.id === id))
      .filter(Boolean);

    const customizedItem = {
      ...item,
      selectedOptions: selections,        // single source of truth now
      selectedSize: selectedSize || null, // legacy field preserved
      selectedToppings,                   // legacy field preserved
      specialInstructions: specialInstructions.trim(),
      customizedPrice: unitPrice,
      assignedTo: assigned,
      optionsCatalog: groups,
      cartRowId: preset?.cartRowId || null,
      cartId: preset?.cartId || null,
    };

    onAddToCart?.(customizedItem, quantity);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/50 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customize item"
    >
      <div
        className="bg-card w-full max-w-2xl max-h-[90vh] md:rounded-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Customize Your Order</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Item Info */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                <Image src={item?.image} alt={item?.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground mb-1 truncate">{item?.name}</h3>
                {item?.description && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                )}
                <div className="text-lg font-bold text-foreground font-mono">
                  ${Number(item?.price || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Assign to Team Members (multi, up to quantity) */}
          {activeTeam?.id && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold text-foreground">Assign to Team Member(s)</h4>
                <div className="text-xs text-muted-foreground">
                  {assigneeIds.length}/{quantity} selected
                </div>
              </div>

              {membersLoading ? (
                <div className="text-sm text-muted-foreground">Loading members…</div>
              ) : (
                <div className="max-w-sm">
                  <Select
                    multiple
                    searchable
                    value={assigneeIds}
                    onChange={(vals) => {
                      const arr = Array.isArray(vals) ? vals : (vals ? [vals] : []);
                      setAssigneeIds(arr.slice(0, quantity)); // cap by quantity
                    }}
                    // placeholder={`Select up to ${quantity} ${quantity > 1 ? 'assignees' : 'assignee'} (optional)`}
                    options={optionsList}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />

                  {filteredOptionsList.length === 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      No matches. Try a different search.
                    </div>
                  )}

                  {assigneeIds.length > quantity && (
                    <div className="mt-1 text-xs text-error">
                      You can assign at most {quantity}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Generic option groups (covers Size, Toppings, Sauce, etc.) */}
          {groups.length > 0 && (
            <div className="p-4 border-b border-border space-y-4">
              {groups.map((g) => {
                const chosen = selections[g.id] || [];
                const need = g.min ?? (g.required ? 1 : 0);
                const showError = g.required && chosen.length < need;
                return (
                  <div key={g.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-border flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {g.name}
                        {g.required && <span className="ml-2 text-xs text-primary">Required</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.type === 'single'
                          ? 'Choose 1'
                          : g.max !== Infinity
                          ? `Up to ${g.max}`
                          : 'Choose any'}
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {g.options.map((o) => {
                        const isChecked = chosen.includes(o.id);
                        return (
                          <label
                            key={o.id}
                            className="flex items-center justify-between px-2 py-2 rounded hover:bg-muted/40 cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              {g.type === 'single' ? (
                                <input
                                  type="radio"
                                  className="w-4 h-4 accent-primary"
                                  checked={isChecked}
                                  onChange={() => toggleOption(g, o.id)}
                                  name={`opt-${g.id}`}
                                />
                              ) : (
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 accent-primary"
                                  checked={isChecked}
                                  onChange={() => toggleOption(g, o.id)}
                                />
                              )}
                              <div>
                                <div className="text-sm font-medium text-foreground">{o.name}</div>
                                {o.description && (
                                  <div className="text-xs text-muted-foreground">{o.description}</div>
                                )}
                              </div>
                            </div>
                            {typeof o.price === 'number' ? (
                              <div className="text-sm font-mono">
                                {g.pricingMode === 'absolute'
                                  ? `$${o.price.toFixed(2)}`
                                  : (o.price > 0 ? `+${o.price.toFixed(2)}` : o.price.toFixed(2))}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">Included</div>
                            )}
                          </label>
                        );
                      })}
                    </div>

                    {showError && (
                      <div className="px-3 py-2 text-xs text-error">Please select at least {need}.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Special Instructions */}
          <div className="p-4 border-b border-border">
            <h4 className="text-lg font-semibold text-foreground mb-3">Special Instructions</h4>
            <textarea
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="Any special requests? (e.g., extra sauce, no onions)"
              className="mb-10 w-full p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              rows={2}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Quantity:</span>
              <div className="flex items-center gap-2 bg-muted rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-8 h-8"
                >
                  <Icon name="Minus" size={14} />
                </Button>
                <span className="text-sm font-semibold w-8 text-center">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-8 h-8"
                >
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
            </div>

            <div className="text-xl font-bold text-foreground font-mono">
              ${total.toFixed(2)}
            </div>
          </div>

          <Button onClick={handleAdd} className="w-full" disabled={missingRequired}>
            {isEditing ? `Save changes • $${total.toFixed(2)}` : `Add ${quantity} to Cart • $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ItemCustomizationModal;