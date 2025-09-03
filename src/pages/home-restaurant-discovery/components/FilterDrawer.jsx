// src/pages/home-restaurant-discovery/components/FilterDrawer.jsx
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const priceRanges = [
  { id: '$',    label: '$ - Under $15' },
  { id: '$$',   label: '$$ - $15-25' },
  { id: '$$$',  label: '$$$ - $25-35' },
  { id: '$$$$', label: '$$$$ - Over $35' },
];

const ratings = [
  { id: '4.5', label: '4.5+ Stars' },
  { id: '4.0', label: '4.0+ Stars' },
  { id: '3.5', label: '3.5+ Stars' },
  { id: '3.0', label: '3.0+ Stars' },
];

const cuisineTypes = [
  { id: 'american',      label: 'American' },
  { id: 'asian',         label: 'Asian' },
  { id: 'italian',       label: 'Italian' },
  { id: 'mexican',       label: 'Mexican' },
  { id: 'indian',        label: 'Indian' },
  { id: 'chinese',       label: 'Chinese' },
  { id: 'thai',          label: 'Thai' },
  { id: 'mediterranean', label: 'Mediterranean' },
];

function countActive(f) {
  if (!f) return 0;
  return (f.priceRange?.length || 0) + (f.rating ? 1 : 0) + (f.cuisineTypes?.length || 0);
}

const FilterDrawer = ({ isOpen, onClose, value, onChange, onReset, anchorRef, offset }) => {
  // ---- state/derived
  const filters = value || { priceRange: [], rating: '', cuisineTypes: [] };
  const patch = (p) => onChange?.({ ...filters, ...p });

  // autosave on change
  const toggleArrayItem = (key, id, checked) => {
    const set = new Set(filters[key] || []);
    checked ? set.add(id) : set.delete(id);
    patch({ [key]: Array.from(set) });
  };
  const setRating = (id) => patch({ rating: filters.rating === id ? '' : id });

  const activeCount = countActive(filters);

  // ---- anchored position (desktop)
  const popRef = useRef(null);
  const [pos, setPos] = useState({ left: 0, top: 0, origin: 'top left' });
  const dx = typeof offset?.x === 'number' ? offset.x : 8;
  const dy = typeof offset?.y === 'number' ? offset.y : 8;

  const placePopover = () => {
    if (!isOpen) return;                        // guard: only when visible
    const anchorEl = anchorRef?.current;
    const popEl = popRef.current;
    if (!anchorEl || !popEl) return;

    const r = anchorEl.getBoundingClientRect();
    const margin = 8;
    const desiredLeft = r.left + dx;
    let top = r.bottom + dy;

    const width = popEl.offsetWidth || 320;
    const maxLeft = window.innerWidth - width - margin;
    const left = Math.max(margin, Math.min(desiredLeft, maxLeft));

    const popH = popEl.offsetHeight || 400;
    if (top + popH + margin > window.innerHeight) {
      top = Math.max(margin, r.top - popH - dy);
      setPos({ left, top, origin: 'bottom left' });
    } else {
      setPos({ left, top, origin: 'top left' });
    }
  };

  // keep hooks order stable: call them always, but no-op when closed
  useLayoutEffect(() => { placePopover(); }, [isOpen, dx, dy]);
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => placePopover();
    window.addEventListener('resize', handler, { passive: true });
    window.addEventListener('scroll', handler, { passive: true });
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler);
    };
  }, [isOpen, dx, dy]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const content = (
    <>
      {/* Cuisine Types */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Cuisine Type</h4>
        <div className="space-y-2">
          {cuisineTypes.map((c) => (
            <Checkbox
              key={c.id}
              label={c.label}
              checked={filters.cuisineTypes?.includes(c.id)}
              onChange={(e) => toggleArrayItem('cuisineTypes', c.id, e.target.checked)}
            />
          ))}
        </div>
      </div>
      {/* Rating */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Minimum Rating</h4>
        <div className="space-y-2">
          {ratings.map((r) => {
            const active = filters.rating === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setRating(r.id)}
                className={`w-full text-left p-2 transition-micro rounded-none ${
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
                aria-pressed={active}
              >
                <div className="flex items-center space-x-2">
                  <Icon name="Star" size={16} className="text-warning fill-current" />
                  <span className="text-sm">{r.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {/* Price Range */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Price Range</h4>
        <div className="space-y-2">
          {priceRanges.map((p) => (
            <Checkbox
              key={p.id}
              label={p.label}
              checked={filters.priceRange?.includes(p.id)}
              onChange={(e) => toggleArrayItem('priceRange', p.id, e.target.checked)}
            />
          ))}
        </div>
      </div>
    </>
  );

  // ----- RENDER (conditionally output, but never early-return)
  return (
    <>
      {/* Click-away layer */}
      {isOpen && <div className="fixed inset-0 z-[1100]" onClick={onClose} />}

      {/* Mobile: bottom sheet */}
      {isOpen && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-[1110] bg-card rounded-none shadow-elevation-2 max-h-[80vh] overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold">Filters</h3>
            <div className="flex items-center space-x-2">
              {activeCount > 0 && <span className="text-sm text-primary font-medium">{activeCount} active</span>}
              <Button variant="ghost" size="icon" onClick={onClose}><Icon name="X" size={20} /></Button>
            </div>
          </div>
          <div className="overflow-y-auto p-4 space-y-6" style={{ maxHeight: 'calc(80vh - 70px)' }}>
            {content}
          </div>
        </div>
      )}

      {/* Desktop: anchored popover */}
      {isOpen && (
        <div
          ref={popRef}
          className="hidden md:flex flex-col z-[1110] fixed w-80 bg-card border border-border rounded-none shadow-elevation-2"
          style={{ left: pos.left, top: pos.top, transformOrigin: pos.origin }}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-lg font-semibold">Filters</h3>
            <div className="flex items-center space-x-2">
              {activeCount > 0 && <span className="text-sm text-primary font-medium">{activeCount} active</span>}
              <Button variant="ghost" size="icon" onClick={onClose}><Icon name="X" size={20} /></Button>
            </div>
          </div>
          <div className="overflow-y-auto p-4 space-y-6" style={{ maxHeight: '60vh' }}>
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default FilterDrawer;
