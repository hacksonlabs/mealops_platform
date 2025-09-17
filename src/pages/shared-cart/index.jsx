// src/pages/shared-cart/index.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import MenuSearch from '../restaurant-detail-menu/components/MenuSearch';
import MenuSection from '../restaurant-detail-menu/components/MenuSection';
import RestaurantHero from '../restaurant-detail-menu/components/RestaurantHero';
import ItemCustomizationModal from '../restaurant-detail-menu/components/ItemCustomizationModal';

import cartDbService from '../../services/cartDBService';
import { useSharedCart } from '../../contexts/SharedCartContext';
import { useAuth } from '../../contexts';
import { pickDefaultProvider } from '../../services/menuProviderService';
import { useProviderMenu, useEditModal, useMenuFiltering } from '@/hooks/restaurant-details';
import useDistanceMiles from '../../hooks/common/useDistanceMiles';

const EMAIL_GATE_VERSION = 'v1'; // bump if you change the schema of what you store

function SharedCartHeader({ teamLine, onOpenCart }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40
                 bg-white dark:bg-white border-b border-border shadow-sm"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Company Logo"
            className="h-6 w-auto"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="hidden sm:inline text-sm font-medium text-muted-foreground">|</span>
          <div className="text-sm font-medium text-foreground truncate">{teamLine}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open cart"
          onClick={onOpenCart}
          title="Open cart"
        >
          <Icon name="ShoppingCart" size={20} />
        </Button>
      </div>
    </header>
  );
}


// --- Small inline modal component (blocking) ---
function EmailGateModal({
  isOpen,
  creatorName,
  onSubmitEmail,
  loading,
	serverError,
	onClearError,
}) {
  const [email, setEmail] = useState('');
  const [touched, setTouched] = useState(false);

  const isValidEmail = useMemo(() => {
    // Simple RFC5322-ish—good enough for UI gating
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }, [email]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[2000]">
      {/* Backdrop + fade (blocks interaction underneath) */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative h-full w-full flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden">
          {/* Header */}
          <div className="p-4 md:p-5 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="Mail" size={18} />
              <h2 className="text-lg font-semibold text-foreground">Join this team cart</h2>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 md:p-5 space-y-3">
            <p className="text-sm text-muted-foreground">
              {creatorName ? (
                <>The organizer <span className="font-medium text-foreground">{creatorName}</span> probably used their <span className="font-medium">.edu/school</span> email when sharing this link.</>
              ) : (
                <>The organizer probably used their <span className="font-medium">.edu/school</span> email when sharing this link.</>
              )}{' '}
              Enter yours below so we can add you to the cart.
            </p>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Your email</label>
              <input
                autoFocus
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
								onFocus={() => { setTouched(false); onClearError?.(); }}
                className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2
                  ${touched && !isValidEmail ? 'border-destructive ring-destructive/20' : 'border-border ring-primary/30'}
                  bg-background`}
                placeholder="you@school.edu"
              />
              {touched && !isValidEmail && (
                <p className="mt-1 text-xs text-destructive">Please enter a valid email.</p>
              )}
							{!!serverError && (
								<p className="mt-2 text-xs text-destructive">{serverError}</p>
							)}
              <p className="mt-2 text-[11px] text-muted-foreground">
                We’ll use this to associate your choices with the team cart.
              </p>
            </div>
          </div>

          {/* Footer (no close button; must submit) */}
          <div className="p-3 md:p-4 border-t border-border flex items-center justify-end gap-2">
            <Button
              onClick={() => onSubmitEmail(email.trim())}
              disabled={!isValidEmail || loading}
            >
              {loading ? 'Saving…' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const SharedCartMenu = () => {
  const { cartId } = useParams();
  const location = useLocation();
  const { setActiveCartId } = useSharedCart();
  const { user } = useAuth(); // { id, email, ... } if you expose it in your context

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [snap, setSnap] = useState(null); // { cart, restaurant, team, creator }
  const [gateOpen, setGateOpen] = useState(true);
  const [gateBusy, setGateBusy] = useState(false);
	const [gateErr, setGateErr] = useState('');

  // Load the cart snapshot (gives us restaurant + locked provider + (optionally) creator name)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setErr('');
      try {
        const s = await cartDbService.getSharedCartMeta(cartId);
        if (!cancelled) setSnap(s);
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load shared cart.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cartId]);

  // Set active cart for the drawer/contexts
  useEffect(() => {
    if (cartId) setActiveCartId?.(cartId);
  }, [cartId, setActiveCartId]);

  // Determine if we should show the gate (per cart+user)
  useEffect(() => {
    if (!cartId) return;
    const storageKey = `sharedCart:gate:${EMAIL_GATE_VERSION}:${cartId}:${user?.id || 'anon'}`;
    const raw = localStorage.getItem(storageKey);
    setGateOpen(!raw); // open if no prior value stored
  }, [cartId, user?.id]);

  const restaurant = snap?.restaurant || null;
  const lockedProvider = snap?.cart?.providerType || pickDefaultProvider(restaurant?.supported_providers || ['grubhub']);
  const creatorName = snap?.creator?.fullName || null;

  // Distance calc
  const computedDistanceMi = useDistanceMiles({
    restaurant,
    fulfillment: {
      service: snap?.cart?.fulfillment?.service || null,
			address: snap?.cart?.fulfillment?.address || null,
			coords:  snap?.cart?.fulfillment?.coords || null,
			date:    snap?.cart?.fulfillment?.date   || null,
			time:    snap?.cart?.fulfillment?.time   || null,
    }
  });

  const teamLine =
    (snap?.team?.name && snap?.team?.gender && snap?.team?.sport)
      ? `${snap.team.name} • ${snap.team.gender} ${snap.team.sport}`
      : 'Your Team • Girls Soccer';

  // Provider menu (locked)
  const {
    providerCategories,
    providerItemsByCat,
    loadingMenu,
    providerError
  } = useProviderMenu({ restaurant, provider: lockedProvider });

  // Search/filter plumbing
  const { searchQuery, setSearchQuery, filteredMenuItems } =
    useMenuFiltering({ providerItemsByCat, providerCategories });

  // Item edit modal plumbing
  const { selectedItem, isOpen, openForItem, closeModal, presetForSelected } =
    useEditModal({ location, menuRaw: null, EXTRA_SENTINEL: '__EXTRA__' });



  const EXTRA_SENTINEL = '__EXTRA__';

	const moneyToNumber = (v) => {
		if (v == null) return null;
		if (typeof v === 'number' && Number.isFinite(v)) return v;
		const n = Number(String(v).replace(/[^\d.]/g, ''));
		return Number.isFinite(n) ? n : null;
	};

	const pickUnitPrice = (it = {}) => {
		// priority: customized -> plain/unit -> nested -> cents
		const a = moneyToNumber(it.customizedPrice);
		if (a != null) return a;

		const b = moneyToNumber(it.unitPrice ?? it.price ?? it?.pricing?.price);
		if (b != null) return b;

		const cents =
			it.price_cents ?? it.priceCents ?? it?.pricing?.price_cents ?? it?.pricing?.priceCents;
		if (Number.isFinite(Number(cents))) return Number(cents) / 100;

		return 0;
	};

	const handleAddToCart = async (customizedItem, quantity = 1) => {
		if (!cartId) return;

		const memberIds = (customizedItem.assignedTo || []).map(a => a?.id).filter(Boolean);
		const extraCount = (customizedItem.assignedTo || [])
			.filter(a => a?.name === 'Extra' || a?.id === EXTRA_SENTINEL).length;
		const displayNames = (customizedItem.assignedTo || []).map(a => a?.name).filter(Boolean);

		const unitPrice = pickUnitPrice(customizedItem);
		const selectedOptions = customizedItem.selectedOptions || '';

		if (customizedItem.cartRowId) {
			// editing an existing row
			const selWithAssign = {
				...selectedOptions,
				__assignment__: { member_ids: memberIds, extra_count: extraCount, display_names: displayNames },
			};
			await cartDbService.updateItem(cartId, customizedItem.cartRowId, {
				quantity,
				price: unitPrice,
				special_instructions: customizedItem.specialInstructions || '',
				selected_options: selWithAssign,
			});
		} else {
			// adding a new row
			await cartDbService.addItem(cartId, {
				menuItem: { id: customizedItem.id, name: customizedItem.name },
				quantity,
				unitPrice, // <- always numeric now
				specialInstructions: customizedItem.specialInstructions || '',
				selectedOptions,
				assignment: { memberIds, extraCount, displayNames },
			});
		}

		// refresh the cart badge
		// const snap = await cartDbService.getCartSnapshot(cartId);
		// if (snap) {
		// 	const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
		// 	const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
		// 	window.dispatchEvent(new CustomEvent('cartBadge', {
		// 		detail: {
		// 			count, total,
		// 			name: snap.cart?.title?.trim()
		// 				? `${snap.cart.title} • Cart`
		// 				: (snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart'),
		// 			cartId,
		// 			restaurant: snap.restaurant,
		// 			items: snap.items,
		// 		},
		// 	}));
		// }
	};



  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image,
      cuisine: restaurant.cuisine_type || restaurant.cuisine || '',
      rating: n(restaurant.rating),
      distance: n(restaurant.distance) ?? computedDistanceMi,
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone || '',
      address: restaurant.address || '',
      coordinates: restaurant._coords || undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [], ratingBreakdown: [], reviews: []
    };
  }, [restaurant, computedDistanceMi]);

  // Optional: auto-open cart drawer from link param (?openCart=1)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openCart') === '1') {
      window.dispatchEvent(new CustomEvent('openCartDrawer', { detail: { cartId } }));
    }
  }, [location.search, cartId]);

  // Handle email submit (UI-only persist for now)
  const submitGateEmail = async (email) => {
    setGateBusy(true);
		setGateErr('');
    try {
      await cartDbService.joinCartWithEmail(cartId, email);
      // Persist locally so we don’t prompt again
      const storageKey = `sharedCart:gate:${EMAIL_GATE_VERSION}:${cartId}:${user?.id || 'anon'}`;
      localStorage.setItem(storageKey, JSON.stringify({ email, at: Date.now() }));
      setGateOpen(false);
		} catch (e) {
			setGateErr(e?.message || 'Could not verify your email for this team.');
		} finally {
      setGateBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="animate-pulse space-y-4 max-w-5xl mx-auto">
          <div className="h-8 w-1/3 bg-muted rounded" />
          <div className="h-48 w-full bg-muted rounded" />
          <div className="h-6 w-1/4 bg-muted rounded" />
          <div className="h-6 w-1/2 bg-muted rounded" />
        </div>
      </main>
    );
  }
  if (err || !restaurant) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto text-destructive">{err || 'Cart/restaurant not found.'}</div>
      </main>
    );
  }

  return (
		<main className="min-h-screen bg-background relative">
			<SharedCartHeader
				teamLine={teamLine}
				onOpenCart={() =>
					window.dispatchEvent(new CustomEvent('openCartDrawer', { detail: { cartId } }))
				}
			/>

			{/* Content container gets top padding equal to header height*/}
			<div className={`pt-16 ${gateOpen ? 'pointer-events-none opacity-50' : ''}`}>
				<div className="max-w-5xl mx-auto px-4 md:px-6">
					<RestaurantHero
						restaurant={heroRestaurant}
						selectedService={snap?.cart?.fulfillment?.service || 'delivery'}
						onServiceToggle={() => {}}
						rightContent={
							<div className="w-full md:w-80">
								<MenuSearch
									searchQuery={searchQuery}
									onSearch={setSearchQuery}
									onClearSearch={() => setSearchQuery('')}
								/>
							</div>
						}
					/>

            {providerError && <p className="text-sm text-destructive mt-2">{providerError}</p>}
            {loadingMenu && <div className="animate-pulse text-sm text-muted-foreground mt-2">Loading menu…</div>}

            {/* Menu list */}
            <div className="pb-32">
              {Object.keys(filteredMenuItems || {}).length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
                  <p className="text-muted-foreground">Try a different search.</p>
                </div>
              ) : (
                Object.keys(filteredMenuItems).map((categoryId) => {
                  const category = (providerCategories || []).find((c) => c.id === categoryId);
                  const items = filteredMenuItems[categoryId];
                  return (
                    <MenuSection
                      key={categoryId}
                      category={category}
                      items={items}
                      onAddToCart={handleAddToCart}
                      onItemClick={(item) => openForItem(item)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

      {/* Forced email modal */}
      <EmailGateModal
        isOpen={gateOpen}
        creatorName={creatorName}
        onSubmitEmail={submitGateEmail}
        loading={gateBusy}
				serverError={gateErr}
				onClearError={() => setGateErr('')}
      />

      {/* Reuse your existing edit/add modal */}
      <ItemCustomizationModal
        item={selectedItem}
        isOpen={isOpen}
        onClose={closeModal}
        preset={presetForSelected}
        onAddToCart={handleAddToCart}
      />
    </main>
  );
};

export default SharedCartMenu;
