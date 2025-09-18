import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/custom/Button';
import Select from '../../../components/ui/custom/Select';
import { useAuth } from '../../../contexts';

// use the same constant you use elsewhere in the app
import { EXTRA_SENTINEL } from '@/hooks/cart/constants';

// hooks (new)
import { useMembers } from '@/hooks/cart';
import { useItemSelections } from '@/hooks/cart';
import { useAssignees } from '@/hooks/cart';

const SharedItemCustomizationModal = ({
  item,
  isOpen,
  onClose,
  onAddToCart,
  preset,
  verifiedIdentity,
}) => {
  const { activeTeam } = useAuth();
  const isEditing = !!(preset?.cartRowId || item?.cartRowId);

  // quantity lives here (affects price + assignee cap)
  const [quantity, setQuantity] = useState(1);

  // reset quantity on open
  useEffect(() => { if (isOpen) setQuantity(1); }, [isOpen, item]);

  // data
  const { members, membersLoading } = useMembers({ teamId: activeTeam?.id, isOpen });

  // options + selections
  const {
    groups,
    sizeGroup,
    toppingsGroup,
    selections,
    setSelections,
    unitPrice,
    missingRequired,
  } = useItemSelections({ isOpen, item, preset });

  const total = useMemo(() => unitPrice * quantity, [unitPrice, quantity]);

  // assignees (includes autopopulate + hydration)
  const { assigneeIds, setAssigneeIds, optionsList } = useAssignees({
    isOpen,
    isEditing,
    preset,
    item,
    members,
    verifiedIdentity,
    quantity,
    EXTRA_SENTINEL,
  });

  // toggle option
  const toggleOption = (group, optId) => {
    setSelections((prev) => {
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

  // finalize
  const handleAdd = () => {
    if (missingRequired) return;

    const assigned = assigneeIds
      .map((id) => {
        if (id === EXTRA_SENTINEL) return { id: EXTRA_SENTINEL, name: 'Extra', role: null, email: null, phone: null };
        const m = members.find((mm) => mm.id === id);
        return m
          ? { id: m.id, name: m.full_name, role: m.role, email: m.email, phone: m.phone_number || null }
          : null;
      })
      .filter(Boolean);

    const addedByMemberId = verifiedIdentity?.memberId ?? null;

    const selectedSizeId = sizeGroup ? (selections[sizeGroup.id] || [])[0] : null;
    const selectedSize = selectedSizeId ? sizeGroup.options.find((o) => o.id === selectedSizeId) : null;

    const selectedToppings = (toppingsGroup ? (selections[toppingsGroup.id] || []) : [])
      .map((id) => toppingsGroup.options.find((o) => o.id === id))
      .filter(Boolean);

    const customizedItem = {
      ...item,
      selectedOptions: selections,
      selectedSize: selectedSize || null,
      selectedToppings,
      specialInstructions: (item?.specialInstructions || '').trim(),
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
        className="
          bg-card w-full max-w-2xl md:rounded-lg overflow-hidden
          h-[90vh] md:h-auto md:max-h-[90vh]
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="
            sticky top-0 bg-card border-b border-border
            p-3 md:p-4
            pt-[max(0px,env(safe-area-inset-top))] md:pt-4
            flex items-center justify-between
          "
        >
          <h2 className="text-base md:text-xl font-semibold text-foreground">Customize Your Order</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="w-8 h-8 md:w-10 md:h-10">
            <Icon name="X" size={18} className="md:hidden" />
            <Icon name="X" size={20} className="hidden md:block" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div
          className="
            overflow-y-auto
            max-h-[calc(90vh-132px)] md:max-h-[calc(90vh-160px)] pb-10
          "
        >
          {/* Item info */}
          <div className="p-3 md:p-4 border-b border-border">
            <div className="flex gap-3 md:gap-4">
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden shrink-0">
                <Image src={item?.image} alt={item?.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base md:text-lg font-semibold text-foreground mb-1 truncate">{item?.name}</h3>
                {item?.description && (
                  <p className="text-xs md:text-sm text-muted-foreground mb-2 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="text-base md:text-lg font-bold text-foreground font-mono">
                  ${Number(item?.price || 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Assign to Team Members */}
          {activeTeam?.id && (
            <div className="p-3 md:p-4 border-b border-border">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-base md:text-lg font-semibold text-foreground">Assign to Team Member(s)</h4>
                <div className="text-[11px] md:text-xs text-muted-foreground">
                  {assigneeIds.length}/{quantity} selected
                </div>
              </div>

              {membersLoading ? (
                <div className="text-sm text-muted-foreground">Loading members…</div>
              ) : (
                <div className="max-w-xs md:max-w-sm">
                  <Select
                    multiple
                    searchable
                    value={assigneeIds}
                    onChange={(vals) => {
                      const arr = Array.isArray(vals) ? vals : (vals ? [vals] : []);
                      setAssigneeIds(arr.slice(0, quantity));
                    }}
                    options={optionsList}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                  />
                  {assigneeIds.length > quantity && (
                    <div className="mt-1 text-[11px] md:text-xs text-error">
                      You can assign at most {quantity}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Option groups */}
          {groups.length > 0 && (
            <div className="p-3 md:p-4  space-y-3 md:space-y-4">
              {groups.map((g) => {
                const chosen = selections[g.id] || [];
                const need = g.min ?? (g.required ? 1 : 0);
                const showError = g.required && chosen.length < need;
                return (
                  <div key={g.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-2 md:px-3 py-2 border-b border-border flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {g.name}
                        {g.required && <span className="ml-2 text-[11px] md:text-xs text-primary">Required</span>}
                      </div>
                      <div className="text-[11px] md:text-xs text-muted-foreground">
                        {g.type === 'single' ? 'Choose 1' : g.max !== Infinity ? `Up to ${g.max}` : 'Choose any'}
                      </div>
                    </div>

                    <div className="p-1.5 md:p-2 space-y-0.5 md:space-y-1">
                      {g.options.map((o) => {
                        const isChecked = chosen.includes(o.id);
                        return (
                          <label
                            key={o.id}
                            className="
                              flex items-center justify-between
                              px-2 py-2 rounded
                              hover:bg-muted/40 cursor-pointer
                            "
                          >
                            <div className="flex items-center gap-2.5 md:gap-3">
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
                                <div className="text-sm md:text-sm font-medium text-foreground">{o.name}</div>
                                {o.description && (
                                  <div className="text-[11px] md:text-xs text-muted-foreground">{o.description}</div>
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
                      <div className="px-2 md:px-3 py-2 text-[11px] md:text-xs text-error">
                        Please select at least {need}.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="
            sticky bottom-0 bg-card border-t border-border
            p-3 md:p-4
            pb-[max(12px,calc(env(safe-area-inset-bottom)+8px))] md:pb-4
          "
        >
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-3 md:gap-4">
              <span className="text-sm text-muted-foreground">Quantity:</span>
              <div className="flex items-center gap-2 bg-muted rounded-lg">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-7 h-7 md:w-8 md:h-8"
                >
                  <Icon name="Minus" size={14} />
                </Button>
                <span className="text-sm font-semibold w-7 md:w-8 text-center">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-7 h-7 md:w-8 md:h-8"
                >
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
            </div>
            <div className="text-lg md:text-xl font-bold text-foreground font-mono">${total.toFixed(2)}</div>
          </div>

          <Button onClick={handleAdd} className="w-full" disabled={missingRequired}>
            {isEditing ? `Save changes • $${total.toFixed(2)}` : `Add ${quantity} to Cart • $${total.toFixed(2)}`}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SharedItemCustomizationModal;
