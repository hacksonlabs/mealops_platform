import React, { useRef, useState } from 'react';
import Header from '@/components/ui/Header';
import FulfillmentBar from '@/components/ui/FulfillmentBar';
import RestaurantGrid from './components/RestaurantGrid';
import FilterDrawer from './components/FilterDrawer';
import DiscoveryActionBar from './components/DiscoveryActionBar';

import useDiscoveryFilters from '@/hooks/restaurant-discovery/useDiscoveryFilters';
import useDiscoveryFulfillment from '@/hooks/restaurant-discovery/useDiscoveryFulfillment';
import useHeaderSearch from '@/hooks/common/useHeaderSearch';

const HomeRestaurantDiscovery = () => {
  const filterBtnRef = useRef(null);

  // fulfillment + service synced with URL
  const {
    fulfillment,
    selectedService,
    setSelectedService,
    handleFulfillmentChange,
    setServiceParam,
  } = useDiscoveryFulfillment();

  // search from header event bus
  const [searchQuery] = useHeaderSearch();

  // filters
  const { filters, setFilters, activeCount, clearAll, removeChip } = useDiscoveryFilters();

  // view & misc
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const PICKUP_RADIUS_DEFAULT = 3;
  const DELIVERY_RADIUS_DEFAULT = 6;
  const [pickupRadius, setPickupRadius] = useState(() => {
    const params = new URLSearchParams(location.search);
    const svc = params.get('service') || 'delivery';
    const radiusParam = params.get('pickup_radius');
    const radius = radiusParam ? Number(radiusParam) : PICKUP_RADIUS_DEFAULT;
    return svc === 'pickup' && radius > 0 ? radius : PICKUP_RADIUS_DEFAULT;
  });
  const [deliveryRadius, setDeliveryRadius] = useState(() => {
    const params = new URLSearchParams(location.search);
    const radiusParam = params.get('delivery_radius');
    const radius = radiusParam ? Number(radiusParam) : DELIVERY_RADIUS_DEFAULT;
    return radius > 0 ? Math.min(Math.max(radius, 1), DELIVERY_RADIUS_DEFAULT) : DELIVERY_RADIUS_DEFAULT;
  });
  const params = new URLSearchParams(location.search);
  const initialCartTitle = params.get('title') || '';
  const mealType = params.get('mealType') || '';
  const [gridMeta, setGridMeta] = useState({ count: 0, label: '' });
  const [gridLoading, setGridLoading] = useState(true);


  const clampPickup = (val) => (val && val > 0 ? Math.max(1, Math.round(val)) : PICKUP_RADIUS_DEFAULT);
  const clampDelivery = (val) => {
    if (!val || val <= 0) return DELIVERY_RADIUS_DEFAULT;
    return Math.min(Math.max(Math.round(val), 1), DELIVERY_RADIUS_DEFAULT);
  };

  const handleClearAll = () => {
    clearAll();
    setPickupRadius(PICKUP_RADIUS_DEFAULT);
    setDeliveryRadius(DELIVERY_RADIUS_DEFAULT);
  };

  const handlePickupRadiusChange = (next) => {
    setPickupRadius(clampPickup(next));
  };

  const handleDeliveryRadiusChange = (next) => {
    setDeliveryRadius(clampDelivery(next));
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />

        <DiscoveryActionBar
          ref={filterBtnRef}
          activeCount={activeCount}
          filters={filters}
          onOpenFilters={() => setIsFilterDrawerOpen(true)}
          onRemoveChip={removeChip}
          onClearAll={handleClearAll}
          summary={`${gridMeta.count} restaurants${gridMeta.label ? ` • ${gridMeta.label}` : ''}`}
        />

        {gridLoading && (
          <div className="px-4 lg:px-6 pt-6">
            <div className="bg-muted/40 border border-border/60 rounded-lg px-4 py-3 text-sm text-muted-foreground">
              Loading restaurants…
            </div>
          </div>
        )}

        <RestaurantGrid
          selectedCategory={selectedCategory}
          selectedService={selectedService}
          appliedFilters={filters}
          searchQuery={searchQuery}
          centerCoords={fulfillment.coords}
          radiusMiles={selectedService === 'pickup' ? pickupRadius : deliveryRadius}
          fulfillment={fulfillment}
          onLoadingChange={setGridLoading}
          initialCartTitle={initialCartTitle}
          mealType={mealType}
          onMetaUpdate={setGridMeta}
        />
      </main>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        value={filters}
        onChange={setFilters}
        onReset={handleClearAll}
        anchorRef={filterBtnRef}
        offset={{ x: 12, y: 8 }}
        service={selectedService}
        pickupRadius={pickupRadius}
        onPickupRadiusChange={handlePickupRadiusChange}
        deliveryRadius={deliveryRadius}
        onDeliveryRadiusChange={handleDeliveryRadiusChange}
        deliveryRadiusDefault={DELIVERY_RADIUS_DEFAULT}
        defaultPickupRadius={PICKUP_RADIUS_DEFAULT}
      />
    </div>
  );
};

export default HomeRestaurantDiscovery;
