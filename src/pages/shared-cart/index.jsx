import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';

import Icon from '@/components/AppIcon';
import MenuSearch from '@/pages/restaurant-detail-menu/components/MenuSearch';
import MenuSection from '@/pages/restaurant-detail-menu/components/MenuSection';
import RestaurantHero from '@/pages/restaurant-detail-menu/components/RestaurantHero';
import SharedItemCustomizationModal from './components/SharedItemCustomizationModal';
import SharedCartHeader from './components/SharedCartHeader';
import EmailGateModal from './components/EmailGateModal';
import SharedCartDrawer from '@/pages/shared-cart/components/SharedCartDrawer';
import cartDbService from '@/services/cartDBService';

import { useAuth } from '@/contexts';

import {
  useActivateSharedCart,
  useSharedCartMeta,
  useEmailGate,
  useLockedProviderMenu,
  useMenuSearchFilter,
  useItemEditModal,
  useAddToCart,
} from '@/hooks/cart';

const SharedCartMenu = () => {
  const { cartId } = useParams();
  const location = useLocation();
  const { user } = useAuth(); // { id, email, ... } if exposed in your context

  // Make this the active cart for your global drawer/contexts
  useActivateSharedCart(cartId);

  // Metadata (cart + restaurant + computed hero)
  const {
    loading,
    error,
    snap,
    restaurant,
    lockedProvider,
    creatorName,
    teamLine,
    heroRestaurant,
  } = useSharedCartMeta(cartId);

  // Provider menu (locked to cart's provider)
  const {
    providerCategories,
    providerItemsByCat,
    loadingMenu,
    providerError,
  } = useLockedProviderMenu({ restaurant, provider: lockedProvider });

  // Search/filter
  const { searchQuery, setSearchQuery, filteredMenuItems } =
    useMenuSearchFilter({ providerItemsByCat, providerCategories });

  // Edit/Add modal plumbing (uses EXTRA_SENTINEL under the hood)
  const { selectedItem, isOpen, openForItem, closeModal, presetForSelected } =
    useItemEditModal({ location });

  // Add-to-cart mutation
  const { handleAddToCart } = useAddToCart(cartId);

  // Email gate
  const {
    gateOpen,
    gateBusy,
    gateErr,
    submitGateEmail,
    clearGateError,
		verifiedIdentity,
  } = useEmailGate({ cartId, userId: user?.id });

  // auto-open cart drawer from link param (?openCart=1)
	// Doesn't work yet, but I don't want the cart to open.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('openCart') === '1') {
      window.dispatchEvent(new CustomEvent('openCartDrawer', { detail: { cartId } }));
    }
  }, [location.search, cartId]);

	// Drawer + cart UI state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartBadge, setCartBadge] = useState({ count: 0, total: 0, name: '', cartId });
  const [cartPanel, setCartPanel] = useState({ restaurant: null, items: [], fulfillment: null });

  // Build badge + panel from DB snapshot
  const refreshCart = useCallback(async () => {
    if (!cartId) return;
    const snap = await cartDbService.getCartSnapshot(cartId);
    if (!snap) return;

    const count = (snap.items || []).reduce((n, it) => n + Number(it.quantity || 0), 0);
    const total = (snap.items || []).reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
	
	setCartBadge({
      count,
      total,
      name: snap.restaurant?.name || snap.cart?.title || 'Cart',
      cartId,
    });

    setCartPanel({
      restaurant: snap.restaurant,
      items: snap.items || [],
      fulfillment: {
        service: snap.cart?.fulfillment_service ?? null,
        address: snap.cart?.fulfillment_address ?? null,
        date: snap.cart?.fulfillment_date ?? null,
        time: snap.cart?.fulfillment_time ?? null,
      },
    });
  }, [cartId]);

  // Initial load
  useEffect(() => { refreshCart(); }, [refreshCart]);

  // Realtime subscribe (any item change triggers refresh)
  useEffect(() => {
    if (!cartId) return;
    const unsubscribe = cartDbService.subscribeToCart(cartId, refreshCart);
    return unsubscribe;
  }, [cartId, refreshCart]);

  // Open drawer via custom event
  useEffect(() => {
    const onOpen = (e) => {
      if (!e?.detail?.cartId || e.detail.cartId !== cartId) return;
      setDrawerOpen(true);
    };
    window.addEventListener('openCartDrawer', onOpen);
    return () => window.removeEventListener('openCartDrawer', onOpen);
  }, [cartId]);

  // Optional: immediate badge bump after add (no waiting for realtime)
  useEffect(() => {
    const onUpdated = (e) => {
      if (e?.detail?.cartId === cartId) refreshCart();
    };
    window.addEventListener('cartUpdated', onUpdated);
    return () => window.removeEventListener('cartUpdated', onUpdated);
  }, [cartId, refreshCart]);

  // Edit/remove handlers for the drawer
  const handleEditItem = (it) => {
		// Pass the cart row id so the modal treats this as "editing"
		// Also pass the menu item id so the options/catalog hydrate correctly
		openForItem?.({
			...it,
			cartRowId: it.id,
			id: it.menuItemId ?? it.id,
		});
	};

  const handleRemoveItem = async (it) => {
    try {
      await cartDbService.removeItem(cartId, it.id);
			await refreshCart();
      window.dispatchEvent(new CustomEvent('cartUpdated', { detail: { cartId } }));
    } catch (e) {
      console.error('Remove failed', e);
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

  if (error || !restaurant) {
    return (
      <main className="min-h-screen bg-background p-6">
        <div className="max-w-lg mx-auto text-destructive">{error || 'Cart/restaurant not found.'}</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background relative">
      <SharedCartHeader
        teamLine={teamLine}
        badgeCount={cartBadge.count}
        onOpenCart={() =>
          window.dispatchEvent(new CustomEvent('openCartDrawer', { detail: { cartId } }))
        }
				verifiedIdentity={verifiedIdentity}
      />

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

      <EmailGateModal
        isOpen={gateOpen}
        creatorName={creatorName}
        onSubmitEmail={submitGateEmail}
        loading={gateBusy}
        serverError={gateErr}
        onClearError={clearGateError}
      />

      <SharedItemCustomizationModal
        item={selectedItem}
        isOpen={isOpen}
        onClose={closeModal}
        preset={presetForSelected}
        onAddToCart={handleAddToCart}
				verifiedIdentity={verifiedIdentity}
				cartId={cartId}
				userId={user?.id}
      />

			<SharedCartDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        cartBadge={cartBadge}
        cartPanel={cartPanel}
        onEditItem={handleEditItem}
        onRemoveItem={handleRemoveItem}
      />
    </main>
  );
};

export default SharedCartMenu;