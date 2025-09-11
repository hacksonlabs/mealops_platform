import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Select from '../../../components/ui/Select';
import { useAuth } from '../../../contexts';
import { supabase } from '../../../lib/supabase';

const slug = (s='') =>
  String(s).toLowerCase().replace(/[^\w]+/g,'-').replace(/(^-|-$)/g,'');

function normalizeOptions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw[0]?.options) {
      return raw.map((g, i) => ({
        id: g.id || slug(g.name || `group-${i}`),
        name: g.name || `Options ${i+1}`,
        type: g.type || (g.max && g.max > 1 ? 'multi' : 'single'),
        required: !!g.required,
        min: g.min ?? (g.required ? 1 : 0),
        max: g.max ?? (g.type === 'single' ? 1 : Infinity),
        options: (g.options || []).map((o, j) => ({
          id: o.id || slug(o.name || `opt-${j}`),
          name: o.name || `Option ${j+1}`,
          description: o.description || '',
          price: Number(o.price || 0),
        })),
      }));
    }
    return [{
      id: 'options',
      name: 'Options',
      type: 'multi',
      required: false,
      min: 0,
      max: Infinity,
      options: raw.map((o, i) => ({
        id: o.id || slug(o.name || `opt-${i}`),
        name: o.name || `Option ${i+1}`,
        description: o.description || '',
        price: Number(o.price || 0),
      })),
    }];
  }
  if (typeof raw === 'object') {
    return Object.entries(raw).map(([groupName, arr], gi) => ({
      id: slug(groupName || `group-${gi}`),
      name: groupName || `Options ${gi+1}`,
      type: 'multi',
      required: false,
      min: 0,
      max: Infinity,
      options: (arr || []).map((o, i) => ({
        id: o.id || slug(o.name || `opt-${i}`),
        name: o.name || `Option ${i+1}`,
        description: o.description || '',
        price: Number(o.price || 0),
      })),
    }));
  }
  return [];
}

const ItemCustomizationModal = ({ item, isOpen, onClose, onAddToCart }) => {
  const { activeTeam } = useAuth();

  // Assignment (multi)
  const [membersLoading, setMembersLoading] = useState(false);
  const [members, setMembers] = useState([]); // [{id, full_name, email, role, phone_number}]
  const [assigneeIds, setAssigneeIds] = useState([]);

  // Quantity & options
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedToppings, setSelectedToppings] = useState([]);
  const groups = useMemo(() => normalizeOptions(item?.options), [item?.options]);
  const [selections, setSelections] = useState({});
  const [specialInstructions, setSpecialInstructions] = useState('');

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
    setQuantity(1);
    setSelectedSize(item?.sizes?.[0] || null);
    setSelectedToppings([]);
    setSelections({});
    setSpecialInstructions('');
    setAssigneeIds([]);
  }, [isOpen, item]);

  // Trim assignees when quantity decreases
  useEffect(() => {
    setAssigneeIds((prev) => prev.slice(0, Math.max(1, quantity)));
  }, [quantity]);

  // Load team members (no is_active filter)
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

  const basePrice = useMemo(() => {
    if (selectedSize) return Number(selectedSize?.price || 0);
    return Number(item?.price || 0);
  }, [item?.price, selectedSize]);

  const toppingsPrice = useMemo(
    () => (selectedToppings || []).reduce((s, t) => s + Number(t?.price || 0), 0),
    [selectedToppings]
  );

  const optionsPrice = useMemo(() => {
    let sum = 0;
    for (const g of groups) {
      const chosen = selections[g.id] || [];
      for (const id of chosen) {
        const opt = g.options.find(o => o.id === id);
        if (opt) sum += Number(opt.price || 0);
      }
    }
    return sum;
  }, [groups, selections]);

  const unitPrice = basePrice + toppingsPrice + optionsPrice;
  const total = unitPrice * quantity;

  const toggleTopping = (topping) => {
    setSelectedToppings(prev => {
      const exists = prev.some(t => t?.id === topping?.id);
      return exists ? prev.filter(t => t?.id !== topping?.id) : [...prev, topping];
    });
  };

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

  const missingRequired =
    (item?.sizes?.length > 0 && !selectedSize) ||
    groups.some(g => g.required && (selections[g.id]?.length || 0) < (g.min ?? 1));

  const handleAdd = () => {
    if (missingRequired) return;

    const assigned = assigneeIds
      .map(id => members.find(m => m.id === id))
      .filter(Boolean)
      .map(m => ({
        id: m.id,
        name: m.full_name,
        role: m.role,
        email: m.email,
        phone: m.phone_number || null,
      }));

    const customizedItem = {
      ...item,
      selectedSize: selectedSize || null,
      selectedToppings,
      selectedOptions: selections,
      specialInstructions: specialInstructions.trim(),
      customizedPrice: unitPrice,
      // Array of assignees (length 0..quantity)
      assignedTo: assigned,
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
              ) : members.length > 0 ? (
                <div className="max-w-md">
                  <Select
                    multiple
                    value={assigneeIds}
                    onChange={(vals) => {
                      const arr = Array.isArray(vals) ? vals : (vals ? [vals] : []);
                      setAssigneeIds(arr.slice(0, quantity));
                    }}
                    placeholder={`Select up to ${quantity} member${quantity > 1 ? 's' : ''} (optional)`}
                    options={members.map((m) => ({
                      value: m.id,
                      label: m.full_name || m.email || 'Unnamed',
                    }))}
                  />
                  {assigneeIds.length > quantity && (
                    <div className="mt-1 text-xs text-error">
                      You can assign at most {quantity}.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No members found.</div>
              )}
            </div>
          )}

          {/* Size */}
          {item?.sizes?.length > 0 && (
            <div className="p-4 border-b border-border">
              <h4 className="text-lg font-semibold text-foreground mb-3">
                Choose Size <span className="text-error">*</span>
              </h4>
              <div className="space-y-2">
                {item.sizes.map((size) => (
                  <label
                    key={size?.id || size?.name}
                    className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-micro ${
                      selectedSize?.id === size?.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="size"
                        checked={selectedSize?.id === size?.id}
                        onChange={() => setSelectedSize(size)}
                        className="w-4 h-4 accent-primary"
                      />
                      <div>
                        <div className="font-medium text-foreground">{size?.name}</div>
                        {size?.description && <div className="text-sm text-muted-foreground">{size.description}</div>}
                      </div>
                    </div>
                    <div className="font-semibold font-mono">${Number(size?.price || 0).toFixed(2)}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Toppings */}
          {item?.toppings?.length > 0 && (
            <div className="p-4 border-b border-border">
              <h4 className="text-lg font-semibold text-foreground mb-3">Add Toppings</h4>
              <div className="space-y-2">
                {item.toppings.map((topping) => (
                  <label
                    key={topping?.id || topping?.name}
                    className="flex items-center justify-between p-3 border border-border rounded-lg cursor-pointer hover:border-primary/50 transition-micro"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedToppings.some(t => t?.id === topping?.id)}
                        onChange={() => toggleTopping(topping)}
                      />
                      <div>
                        <div className="font-medium text-foreground">{topping?.name}</div>
                        {topping?.description && <div className="text-sm text-muted-foreground">{topping.description}</div>}
                      </div>
                    </div>
                    <div className="font-semibold font-mono">+${Number(topping?.price || 0).toFixed(2)}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Generic option groups */}
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
                            {o.price ? (
                              <div className="text-sm font-mono">{o.price > 0 ? `+${o.price.toFixed(2)}` : o.price.toFixed(2)}</div>
                            ) : <div className="text-sm text-muted-foreground">Included</div>}
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

          {/* Special Instructions (always) */}
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
            Add {quantity} to Cart • ${total.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ItemCustomizationModal;