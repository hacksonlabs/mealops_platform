// src/pages/restaurant/RestaurantDetailMenu.jsx
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import FulfillmentBar from '../../components/ui/FulfillmentBar';
import RestaurantHero from './components/RestaurantHero';
import MenuSearch from './components/MenuSearch';
import MenuSection from './components/MenuSection';
import ItemCustomizationModal from './components/ItemCustomizationModal';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import ProviderToggle from './components/ProviderToggle';
import InfoTooltip from '../../components/ui/InfoTooltip';
import cartDbService from '../../services/cartDBService';
import { useAuth } from '../../contexts';
import { useProvider } from '../../contexts/ProviderContext';
import { useSharedCart } from '../../contexts/SharedCartContext';
import { pickDefaultProvider } from '../../services/menuProviderService';
import ShareCartButton from './components/ShareCartButton';

// hooks
import { useProviderMenu, useRestaurantWithDbMenu, useEditModal, useMenuFiltering, useFulfillmentUrlSync } from '@/hooks/restaurant-details';
import { useCartOnPage } from '@/hooks/cart';
import useDistanceMiles from '../../hooks/common/useDistanceMiles';

const EXTRA_SENTINEL = '__EXTRA__';

const RestaurantDetailMenu = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurantId } = useParams();
  const { activeTeam } = useAuth();
  const { provider, setProvider } = useProvider();
  const { setActiveCartId } = useSharedCart();
  const initialCartTitle = (location.state?.initialCartTitle ?? '').trim();
  const mealType = (location.state?.mealType ?? '').trim();

  // Fulfillment + URL sync
  const {
    fulfillment, setFulfillment,
    selectedService, setSelectedService,
    syncServiceToUrl
  } = useFulfillmentUrlSync(location, navigate);

  // Restaurant + DB menu (hydration + rows)
  const {
    restaurant, setRestaurant, menuRaw,
    loading: loadingRestaurant, err
  } = useRestaurantWithDbMenu({
    supabase, restaurantId, initialRestaurant: location.state?.restaurant, location
  });

  // Default provider for this restaurant (once hydrated)
  const [localProvider, setLocalProvider] = useState(provider);
  useEffect(() => {
    if (!restaurant) return;
    const providers = restaurant.supported_providers?.length ? restaurant.supported_providers : ['grubhub'];
    const def = pickDefaultProvider(providers);
    setLocalProvider(prev => prev || def);
  }, [restaurant]);

  // Provider menu (fetch + grouped structure)
  const {
    providerCategories,
    providerItemsByCat,
    loadingMenu,
    providerError
  } = useProviderMenu({ restaurant, provider: localProvider });

  // Distance calculation (geocode as needed)
  const computedDistanceMi = useDistanceMiles({ restaurant, fulfillment });

  // Menu filtering + scroll spy + small UI state
  const {
    searchQuery, setSearchQuery,
    filteredMenuItems,
    activeCategory, setActiveCategory
  } = useMenuFiltering({ providerItemsByCat, providerCategories });

  // Cart lifecycle on this page (ensure cart, sync, subscribe)
  const {
    cartId,
    handleAddToCart // add/update item, refresh drawer snapshot
  } = useCartOnPage({
    activeTeam, restaurant, provider: localProvider,
    fulfillment, setProvider, setActiveCartId,
    location, cartDbService, EXTRA_SENTINEL, initialCartTitle, mealType
  });

  // Edit modal boot (coming from Drawer -> “Edit”)
  const {
    selectedItem, isOpen, openForItem, closeModal, presetForSelected
  } = useEditModal({ location, menuRaw, EXTRA_SENTINEL });

  // UI handlers
  const handleServiceToggle = (service) => {
    setSelectedService(service);
    setFulfillment(prev => ({ ...prev, service }));
    syncServiceToUrl(service);
  };
  const handleSearch = (q) => setSearchQuery(q);
  const handleClearSearch = () => setSearchQuery('');
  const handleBackClick = () => navigate('/home-restaurant-discovery');

  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
    const inboundDistance = (() => {
      const v = location.state?.restaurant?.distance;
      const num = Number(v);
      return Number.isFinite(num) ? num : undefined;
    })();
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image || '',
      cuisine: restaurant.cuisine_type || restaurant.cuisine || '',
      rating: n(restaurant.rating),
      distance: inboundDistance ?? n(restaurant.distance) ?? computedDistanceMi,
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone_number || '',
      address: restaurant.address || restaurant._address || '',
      coordinates: restaurant._coords || undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [], ratingBreakdown: [], reviews: []
    };
  }, [restaurant, location.state?.restaurant?.distance, computedDistanceMi]);

  const handleFulfillmentChange = async (next) => {
    setFulfillment(next);
    if (next.service !== selectedService) setSelectedService(next.service);
    syncServiceToUrl(next.service);
    window.dispatchEvent(new CustomEvent('deliveryAddressUpdate', {
      detail: { address: next.address, lat: next.coords ?? null }
    }));
    if (!cartId) return;
    try {
      await cartDbService.upsertCartFulfillment(cartId, next, {
        title: `${restaurant?.name || 'Cart'} • ${localProvider}`,
        providerType: localProvider,
        providerRestaurantId: restaurant?.provider_restaurant_ids?.[localProvider] || null,
      });
    } catch {}
  };

  if (loadingRestaurant) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16 [--sticky-top:64px] md:[--sticky-top:96px]">
          <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-1/3 bg-muted rounded" />
              <div className="h-48 w-full bg-muted rounded" />
              <div className="h-6 w-1/4 bg-muted rounded" />
              <div className="h-6 w-1/2 bg-muted rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (err) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16">
          <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />
          <div className="p-6">
            <div className="text-error">Error: {err}</div>
            <Button className="mt-4" onClick={() => navigate('/home-restaurant-discovery')}>
              Back to discovery
            </Button>
          </div>
        </main>
      </div>
    );
  }
  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />

        {/* Mobile header */}
        <div className="md:hidden p-4 border-b border-border bg-background">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={handleBackClick}>
              <Icon name="ArrowLeft" size={20} />
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate">
              {restaurant?.name}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            >
              <Icon name="Info" size={20} />
            </Button>
          </div>
        </div>

        <div className="flex">
          <div className="flex-1">
            <RestaurantHero
              restaurant={heroRestaurant}
              selectedService={selectedService}
              onServiceToggle={handleServiceToggle}
              rightContent={
                <div className="w-full md:w-80 space-y-3">
                  <MenuSearch
                    searchQuery={searchQuery}
                    onSearch={handleSearch}
                    onClearSearch={handleClearSearch}
                  />
                  <ShareCartButton
                    cartId={cartId}
                    restaurant={restaurant}
                    providerType={localProvider}
                    fulfillment={fulfillment}
                    onCreated={(newId) => setActiveCartId?.(newId)}
                    cartTitle={initialCartTitle}
                    mealType={mealType}
                    className="w-full justify-center md:justify-start"
                  />
                </div>
              }
              belowTitleContent={
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Order Handled By:
                    <InfoTooltip text="Fees and service charges are set by the provider and may vary by location, time, and promotions." />
                  </div>
                  <ProviderToggle
                    providers={restaurant?.supported_providers || ['grubhub']}
                    selected={localProvider}
                    onChange={setLocalProvider}
                    showIcons={false}
                    className="w-full flex-wrap justify-between gap-2 md:w-auto md:justify-start"
                  />
                </div>
              }
            />

            {providerError && <p className="text-sm text-destructive mt-2">{providerError}</p>}
            {loadingMenu && <div className="animate-pulse text-sm text-muted-foreground px-4">Loading menu…</div>}

            {/* Menu */}
            <div className="px-4 md:px-6 pb-32">
              {Object.keys(filteredMenuItems || {}).length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
                  <p className="text-muted-foreground">Try searching for something else or browse our menu categories.</p>
                  <Button variant="outline" onClick={handleClearSearch} className="mt-4">Clear Search</Button>
                </div>
              ) : (
                Object.keys(filteredMenuItems).map((categoryId) => {
                  const category = providerCategories.find((c) => c.id === categoryId);
                  const items = filteredMenuItems[categoryId];
                  return (
                    <MenuSection
                      key={categoryId}
                      category={category}
                      items={items}
                      onAddToCart={handleAddToCart}
                      onItemClick={(item) => {
                        openForItem(item);
                      }}
                    />
                  );
                })
              )}

              {/* Optional extra info */}
              {/* <RestaurantInfo restaurant={heroRestaurant} /> */}
            </div>
          </div>
        </div>

        <ItemCustomizationModal
          item={selectedItem}
          isOpen={isOpen}
          onClose={closeModal}
          preset={presetForSelected}
          onAddToCart={handleAddToCart}
        />
      </main>
    </div>
  );
};

export default RestaurantDetailMenu;
