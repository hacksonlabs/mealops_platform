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
  const [radiusMiles] = useState(3);
  const [gridLoading, setGridLoading] = useState(true);

  const params = new URLSearchParams(location.search);
  const initialCartTitle = params.get('title') || '';
  const mealType = params.get('mealType') || '';

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
          onClearAll={clearAll}
        />

        <RestaurantGrid
          selectedCategory={selectedCategory}
          selectedService={selectedService}
          appliedFilters={filters}
          searchQuery={searchQuery}
          centerCoords={fulfillment.coords}
          radiusMiles={radiusMiles}
          fulfillment={fulfillment}
          onLoadingChange={setGridLoading}
          initialCartTitle={initialCartTitle}
          mealType={mealType}
        />
      </main>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        value={filters}
        onChange={setFilters}
        onReset={clearAll}
        anchorRef={filterBtnRef}
        offset={{ x: 12, y: 8 }}
      />
    </div>
  );
};

export default HomeRestaurantDiscovery;