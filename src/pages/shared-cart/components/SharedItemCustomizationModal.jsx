import React, { useEffect, useMemo, useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/custom/Button';
import Select from '../../../components/ui/custom/Select';
import { useAuth } from '../../../contexts';
import { supabase } from '../../../lib/supabase';

const EXTRA_SENTINEL = '__EXTRA__'; // guaranteed not to collide with UUIDs
const slug = (s='') => String(s).toLowerCase().replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');

/* ----------------- option helpers (unchanged) ----------------- */
function inferGroupMetaFromName(name) {
  const n = (name || '').toLowerCase();
  if (n === 'size' || n === 'sizes') return { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' };
  if (n === 'topping' || n === 'toppings') return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
  if (/(bun|bread|tortilla|base|protein|rice|sauce|dressing)/i.test(n)) {
    return { type: 'single', required: false, min: 0, max: 1, pricingMode: 'additive' };
  }
  return { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' };
}

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
      pricingMode: m.pricingMode || 'additive',
      options: (list || []).map((o, i) => ({
        id: o.id || slug(o.name || `opt-${i}`),
        name: o.name || `Option ${i+1}`,
        description: o.description || '',
        price: Number(o.price || 0),
      })),
    });
  };

  if (Array.isArray(item?.sizes) && item.sizes.length) {
    pushGroup('size', 'Size', { type: 'single', required: true, min: 1, max: 1, pricingMode: 'absolute' }, item.sizes);
  }
  if (Array.isArray(item?.toppings) && item.toppings.length) {
    pushGroup('toppings', 'Toppings', { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' }, item.toppings);
  }

  const raw = item?.options;
  if (Array.isArray(raw)) {
    if (raw[0]?.options) {
      raw.forEach((g, i) => {
        const meta = g.type
          ? { type: g.type, required: !!g.required, min: g.min, max: g.max, pricingMode: g.pricingMode }
          : inferGroupMetaFromName(g.name);
        pushGroup(g.id || slug(g.name || `group-${i}`), g.name || `Options ${i+1}`, meta, g.options);
      });
    } else {
      pushGroup('options', 'Options', { type: 'multi', required: false, min: 0, max: Infinity, pricingMode: 'additive' }, raw);
    }
  } else if (raw && typeof raw === 'object') {
    Object.entries(raw).forEach(([groupName, arr], gi) => {
      if (!Array.isArray(arr)) return;
      if (/^sizes?$/.test(groupName) && item?.sizes?.length) return;
      if (/^toppings?$/.test(groupName) && item?.toppings?.length) return;
      const meta = inferGroupMetaFromName(groupName);
      pushGroup(slug(groupName || `group-${gi}`), groupName || `Options ${gi+1}`, meta, arr);
    });
  }

  groups.sort((a, b) => (b.pricingMode === 'absolute') - (a.pricingMode === 'absolute'));
  return groups;
}

function findOptionIdByAny(group, val) {
  const vId = typeof val === 'object' ? val?.id : undefined;
  const vName = typeof val === 'object' ? val?.name : (typeof val === 'string' ? val : undefined);
  const byId = vId && group.options.find(o => o.id === vId); if (byId) return byId.id;
  const byName = vName && group.options.find(o => o.name?.toLowerCase() === String(vName).toLowerCase()); if (byName) return byName.id;
  if (typeof val === 'string') { const direct = group.options.find(o => o.id === val); if (direct) return direct.id; }
  return null;
}

function extractMemberIdsFromPreset(assignedTo, members) {
  if (!assignedTo || !Array.isArray(assignedTo)) return [];
  const ids = [];
  assignedTo.forEach(a => {
    if (typeof a === 'string') {
      const s = a.trim().toLowerCase();
      if (s === 'extra') { ids.push(EXTRA_SENTINEL); return; }
      const m = members.find(mm => (mm.full_name || '').toLowerCase() === s);
      if (m) ids.push(m.id);
      return;
    }
    if (a && typeof a === 'object') {
      const nm = (a.name || a.full_name || '').trim().toLowerCase();
      if (nm === 'extra') { ids.push(EXTRA_SENTINEL); return; }
      if (a.id) { ids.push(a.id); return; }
      const m = members.find(mm => (mm.full_name || '').toLowerCase() === nm);
      if (m) ids.push(m.id);
    }
  });
  return ids;
}

/* ----------------- main component ----------------- */
const SharedItemCustomizationModal = ({ item, isOpen, onClose, onAddToCart, preset, verifiedIdentity }) => {
  const { activeTeam } = useAuth();
  const isEditing = !!(preset?.cartRowId || item?.cartRowId);

  // assignment state
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]); // [{id, full_name, email, role, phone_number}]
  const [assigneeIds, setAssigneeIds] = useState([]);
  const [assigneesLocked, setAssigneesLocked] = useState(false);
  const [prefillAssigneeOnOpen, setPrefillAssigneeOnOpen] = useState(true);
	const asgHydratedRef = useRef(false);

  // general state
  const [quantity, setQuantity] = useState(1);
  const groups = useMemo(() => normalizeOptionGroups(item || {}), [item]);
  const [selections, setSelections] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState('');
  const hydratedRef = useRef(false);

  /* ---- UX: close on Esc ---- */
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') { e.preventDefault(); onClose?.(); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  /* ---- reset on open ---- */
  useEffect(() => {
    if (!isOpen) return;
    hydratedRef.current = false;
		asgHydratedRef.current = false;
    setQuantity(1);
    setSelections({});
    setSpecialInstructions('');
    setAssigneeIds([]);
    setAssigneesLocked(false);
		setPrefillAssigneeOnOpen(!isEditing);
  }, [isOpen, item, isEditing]);

  /* ---- default required single group ---- */
  useEffect(() => {
    if (!isOpen) return;
    setSelections(prev => {
      const next = { ...prev };
      groups.forEach(g => {
        if (g.required && g.type === 'single' && !(next[g.id]?.length)) {
          const first = g.options?.[0]?.id;
          if (first) next[g.id] = [first];
        }
      });
      return next;
    });
  }, [isOpen, groups]);

  /* ---- cap assignees to quantity ---- */
  useEffect(() => { setAssigneeIds(prev => prev.slice(0, quantity)); }, [quantity]);

  /* ---- load team members (only verified if you track a flag) ---- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!isOpen || !activeTeam?.id) { setMembers([]); return; }
      setMembersLoading(true);
      try {
        let query = supabase
          .from('team_members')
          .select('id, full_name, email, role, phone_number')
          .eq('team_id', activeTeam.id)
          .order('full_name', { ascending: true });

        // If you store a verified flag, uncomment one of these:
        // query = query.eq('is_verified', true);
        // query = query.eq('status', 'verified');

        const { data, error } = await query;
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

  /* ---- identify the logged-in member ---- */
  const currentMemberId = useMemo(() => {
    if (!members?.length || !verifiedIdentity) return null;
    // exact id match
    if (verifiedIdentity.memberId) {
      const hit = members.find(m => m.id === verifiedIdentity.memberId);
      if (hit) return hit.id;
    }
    // email match
    const email = String(verifiedIdentity.email || '').trim().toLowerCase();
    if (email) {
      const byEmail = members.find(m => String(m.email || '').trim().toLowerCase() === email);
      if (byEmail) return byEmail.id;
    }
    // full name match
    const full = String(verifiedIdentity.fullName || '').trim().toLowerCase();
    if (full) {
      const byName = members.find(m => String(m.full_name || '').trim().toLowerCase() === full);
      if (byName) return byName.id;
    }
    return null;
  }, [members, verifiedIdentity]);

  /* ---- autopopulate once per open (only when creating) ---- */
  useEffect(() => {
    if (!isOpen) return;
    if (isEditing) return;                 // don't override edits
		if (preset) return;                    // if we have a preset, we're editing or hydrating
		if (item?.cartRowId) return;
    if (!members?.length) return;
    if (!currentMemberId) return;
		if (!prefillAssigneeOnOpen) return;    // user interacted or we already prefilled
    if (assigneeIds.length) return; 

    // With quantity = 1, this means they must deselect themselves to pick another.
    setAssigneeIds([currentMemberId].slice(0, quantity));
		setPrefillAssigneeOnOpen(false);
  }, [isOpen, isEditing, preset, item?.cartRowId, members, currentMemberId, assigneeIds?.length, quantity, prefillAssigneeOnOpen]);

  /* ---- pricing ---- */
  const unitPrice = useMemo(() => {
    let base = Number(item?.price || 0), add = 0;
    for (const g of groups) {
      const chosen = selections[g.id] || [];
      if (g.pricingMode === 'absolute') {
        const id = chosen[0]; const opt = g.options.find(o => o.id === id);
        if (opt) base = Number(opt.price || base);
      } else {
        for (const id of chosen) { const opt = g.options.find(o => o.id === id); if (opt) add += Number(opt.price || 0); }
      }
    }
    return base + add;
  }, [item?.price, groups, selections]);
  const total = unitPrice * quantity;

  const missingRequired = useMemo(
    () => groups.some(g => g.required && ((selections[g.id]?.length || 0) < (g.min ?? 1))),
    [groups, selections]
  );

  /* ---- hydrate from preset (once) ---- */
  useEffect(() => {
    if (!isOpen || hydratedRef.current) return;
    if (!preset) return;
    hydratedRef.current = true;

    if (typeof preset.quantity === 'number') setQuantity(Math.max(1, preset.quantity));
    if (typeof preset.specialInstructions === 'string') setSpecialInstructions(preset.specialInstructions);

    const nextSel = {};
    if (preset.selectedOptions && typeof preset.selectedOptions === 'object' && !Array.isArray(preset.selectedOptions)) {
      for (const [key, valsMaybe] of Object.entries(preset.selectedOptions)) {
        const g =
          groups.find(gg => gg.id === key) ||
          groups.find(gg => gg.name?.toLowerCase() === key.toLowerCase()) ||
          groups.find(gg => slug(gg.name) === key);
        if (!g) continue;
        const vals = Array.isArray(valsMaybe) ? valsMaybe : [valsMaybe];
        const ids = vals.map(v => findOptionIdByAny(g, v)).filter(Boolean);
        if (ids.length) nextSel[g.id] = ids;
      }
    } else if (Array.isArray(preset.selectedOptions)) {
      for (const g of groups) {
        const ids = preset.selectedOptions.map(v => findOptionIdByAny(g, v)).filter(Boolean);
        if (ids.length) nextSel[g.id] = ids;
      }
    }

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
      const ids = preset.selectedToppings.map(v => findOptionIdByAny(toppingsGroup, v)).filter(Boolean);
      if (ids.length) nextSel[toppingsGroup.id] = ids;
    }

    setSelections(prev => ({ ...prev, ...nextSel }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, preset, groups]);

	/* ---- hydrate assignees AFTER members load (once per open) ---- */
	useEffect(() => {
		if (!isOpen) return;
		if (asgHydratedRef.current) return;          // only once per open
		if (!members?.length) return;                // wait for members

		// Prefer preset (from DB), fall back to item (from drawer)
		const src = preset || item;
		if (!src) return;

		let ids = [];
		if (Array.isArray(src.assignedTo) && src.assignedTo.length) {
			ids = extractMemberIdsFromPreset(src.assignedTo, members);
		}
		if (!ids.length && src.selectedOptions?.__assignment__) {
			const asg = src.selectedOptions.__assignment__;
			ids = [
				...(Array.isArray(asg.member_ids) ? asg.member_ids : []),
				...Array.from({ length: Number(asg.extra_count || 0) }, () => EXTRA_SENTINEL),
			];
		}

		if (ids.length) {
			setAssigneeIds(ids.slice(0, Math.max(1, src.quantity || 1)));
			setAssigneesLocked(true);
			setPrefillAssigneeOnOpen(false);
			asgHydratedRef.current = true;
		}
	}, [isOpen, members, preset, item, quantity]);


  /* ---- selection handlers ---- */
  const toggleOption = (group, optId) => {
    setSelections(prev => {
      const current = prev[group.id] || [];
      if (group.type === 'single') return { ...prev, [group.id]: [optId] };
      const set = new Set(current);
      if (set.has(optId)) set.delete(optId);
      else {
        if (group.max !== Infinity && set.size >= group.max) return prev;
        set.add(optId);
      }
      return { ...prev, [group.id]: Array.from(set) };
    });
  };

  /* ---- assignee options (includes "Extra") ---- */
  const optionsList = useMemo(() => {
    const base = [{ value: EXTRA_SENTINEL, label: 'Extra' }];
    return base.concat(
      (members || []).map(m => ({
        value: m.id,
        label: m.full_name || m.email || 'Unnamed',
      }))
    );
  }, [members]);

  /* ---- finalize ---- */
  const handleAdd = () => {
    if (missingRequired) return;

    const assigned = assigneeIds
      .map(id => {
        if (id === EXTRA_SENTINEL) return { id: EXTRA_SENTINEL, name: 'Extra', role: null, email: null, phone: null };
        const m = members.find(mm => mm.id === id);
        return m
          ? { id: m.id, name: m.full_name, role: m.role, email: m.email, phone: m.phone_number || null }
          : null;
      })
      .filter(Boolean);
		// the verfied member should be recorded as "added_by_member_id"
		const addedByMemberId = verifiedIdentity?.memberId ?? null;
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
      selectedOptions: selections,
      selectedSize: selectedSize || null,
      selectedToppings,
      specialInstructions: specialInstructions.trim(),
      customizedPrice: unitPrice,
      assignedTo: assigned,
      optionsCatalog: groups,
      cartRowId: item?.cartRowId ?? preset?.cartRowId ?? null,
      cartId: preset?.cartId || null,
			addedByMemberId,
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
          <Button variant="ghost" size="icon" onClick={onClose}><Icon name="X" size={20} /></Button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Item info */}
          <div className="p-4 border-b border-border">
            <div className="flex gap-4">
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
                <Image src={item?.image} alt={item?.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-foreground mb-1 truncate">{item?.name}</h3>
                {item?.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{item.description}</p>}
                <div className="text-lg font-bold text-foreground font-mono">${Number(item?.price || 0).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Assign to Team Members */}
          {activeTeam?.id && (
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-lg font-semibold text-foreground">Assign to Team Member(s)</h4>
                <div className="text-xs text-muted-foreground">{assigneeIds.length}/{quantity} selected</div>
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
                      // enforce “deselect yourself to pick another” when quantity = 1
                      setAssigneeIds(arr.slice(0, quantity));
											setPrefillAssigneeOnOpen(false);
                    }}
                    options={optionsList}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                  {assigneeIds.length > quantity && (
                    <div className="mt-1 text-xs text-error">You can assign at most {quantity}.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Option groups */}
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
                        {g.name}{g.required && <span className="ml-2 text-xs text-primary">Required</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.type === 'single' ? 'Choose 1' : g.max !== Infinity ? `Up to ${g.max}` : 'Choose any'}
                      </div>
                    </div>

                    <div className="p-2 space-y-1">
                      {g.options.map((o) => {
                        const isChecked = chosen.includes(o.id);
                        return (
                          <label key={o.id} className="flex items-center justify-between px-2 py-2 rounded hover:bg-muted/40 cursor-pointer">
                            <div className="flex items-center gap-3">
                              {g.type === 'single' ? (
                                <input type="radio" className="w-4 h-4 accent-primary" checked={isChecked} onChange={() => toggleOption(g, o.id)} name={`opt-${g.id}`} />
                              ) : (
                                <input type="checkbox" className="w-4 h-4 accent-primary" checked={isChecked} onChange={() => toggleOption(g, o.id)} />
                              )}
                              <div>
                                <div className="text-sm font-medium text-foreground">{o.name}</div>
                                {o.description && <div className="text-xs text-muted-foreground">{o.description}</div>}
                              </div>
                            </div>
                            {typeof o.price === 'number' ? (
                              <div className="text-sm font-mono">
                                {g.pricingMode === 'absolute' ? `$${o.price.toFixed(2)}`
                                  : (o.price > 0 ? `+${o.price.toFixed(2)}` : o.price.toFixed(2))}
                              </div>
                            ) : <div className="text-sm text-muted-foreground">Included</div>}
                          </label>
                        );
                      })}
                    </div>

                    {showError && <div className="px-3 py-2 text-xs text-error">Please select at least {need}.</div>}
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
                <Button variant="ghost" size="icon" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8"><Icon name="Minus" size={14} /></Button>
                <span className="text-sm font-semibold w-8 text-center">{quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => setQuantity(quantity + 1)} className="w-8 h-8"><Icon name="Plus" size={14} /></Button>
              </div>
            </div>
            <div className="text-xl font-bold text-foreground font-mono">${(unitPrice * quantity).toFixed(2)}</div>
          </div>

          <Button onClick={handleAdd} className="w-full" disabled={missingRequired}>
            {isEditing ? `Save changes • $${(unitPrice * quantity).toFixed(2)}` : `Add ${quantity} to Cart • $${(unitPrice * quantity).toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SharedItemCustomizationModal;
