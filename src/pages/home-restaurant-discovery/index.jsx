import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import Header from '../../components/ui/Header';
import PrimaryTabNavigation from '../../components/ui/PrimaryTabNavigation';
import CartSummaryFloat from '../../components/ui/CartSummaryFloat';
import DeliveryAddressBanner from '../../components/ui/DeliveryAddressBanner';
import ServiceToggle from './components/ServiceToggle';
import CategoryFilter from './components/CategoryFilter';
import QuickReorderSection from './components/QuickReorderSection';
import RestaurantGrid from './components/RestaurantGrid';
import FilterDrawer from './components/FilterDrawer';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import FulfillmentBar from '../../components/ui/FulfillmentBar';

// helpers
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const emptyFilters = { priceRange: [], rating: '', cuisineTypes: [] };

function countActive(f) {
  return (f.priceRange?.length || 0)
       + (f.rating ? 1 : 0)
       + (f.cuisineTypes?.length || 0);
}

const HomeRestaurantDiscovery = () => {
  const location = useLocation();
  const [selectedService, setSelectedService] = useState('delivery');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMapView, setIsMapView] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [intent, setIntent] = useState(null);
  const [radiusMiles, setRadiusMiles] = useState(3);
  const [filters, setFilters] = useState(emptyFilters);
  const clearAllFilters = () => setFilters(emptyFilters);
  const filterBtnRef = useRef(null);
  const removeChip = (kind, id) => {
    if (kind === 'priceRange' || kind === 'cuisineTypes') {
      const next = new Set(filters[kind] || []);
      next.delete(id);
      setFilters({ ...filters, [kind]: Array.from(next) });
    } else if (kind === 'rating') {
      setFilters({ ...filters, rating: '' });
    }
  };

  const [fulfillment, setFulfillment] = useState({
    service: 'delivery',
    address: '',
    coords: null,
    date: toDateInput(new Date()),
    time: '12:00',
  });

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  // Handle service change
  const handleServiceChange = (service) => {
    setSelectedService(service);
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  };

  // Handle filter application
  const handleApplyFilters = (filters) => {
    setAppliedFilters(filters);
  };

  // Handle map view toggle
  const handleMapViewToggle = () => {
    setIsMapView(!isMapView);
  };

  const handleFulfillmentChange = (next) => {
    setFulfillment(next);
    // rebroadcast address changes to legacy listeners
    window.dispatchEvent(
      new CustomEvent('deliveryAddressUpdate', {
        detail: { address: next.address, lat: next.coords ?? null },
      })
    );
  };

  // Handle search from header
  useEffect(() => {
    const handleSearchUpdate = (event) => {
      if (event?.detail) {
        setSearchQuery(event?.detail?.query);
      }
    };

    window.addEventListener('searchUpdate', handleSearchUpdate);
    return () => window.removeEventListener('searchUpdate', handleSearchUpdate);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const service = qs.get('service');
    const address = qs.get('delivery_address') || qs.get('pickup_address') || qs.get('address') || '';
    const whenISO = qs.get('whenISO');
    const date = qs.get('date');
    const time = qs.get('time');
    const lat = qs.get('lat');
    const lng = qs.get('lng');

    const fromWhen = whenISO ? new Date(whenISO) : null;

    setFulfillment((prev) => ({
      ...prev,
      service: service || prev.service,
      address: address || prev.address,
      coords: lat && lng ? { lat: +lat, lng: +lng } : prev.coords,
      date: date || (fromWhen ? toDateInput(fromWhen) : prev.date),
      time: time || (fromWhen ? toTimeInput(fromWhen) : prev.time),
    }));

    if (address) {
      window.dispatchEvent(
        new CustomEvent('deliveryAddressUpdate', {
          detail: { address, lat: lat && lng ? { lat: +lat, lng: +lng } : null },
        })
      );
    }
  }, [location.search]);

   return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />

        {/* Action Bar */}
        <div className="bg-card border-b border-border">
          <div className="px-4 py-3 lg:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {/* Wrap the button so we can anchor to it */}
                <div ref={filterBtnRef} className="inline-flex">
                  <Button
                    variant="outline"
                    onClick={() => setIsFilterDrawerOpen(true)}
                    className="flex items-center space-x-2"
                  >
                    <Icon name="Filter" size={16} />
                    <span className="text-sm">Filters</span>
                    {countActive(filters) > 0 && <div className="w-2 h-2 bg-primary" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Active filter chips */}
            {countActive(filters) > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.priceRange.map((p) => (
                  <button
                    key={`p-${p}`}
                    onClick={() => removeChip('priceRange', p)}
                    className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
                  >
                    <span>{p}</span>
                    <Icon name="X" size={12} />
                  </button>
                ))}
                {filters.cuisineTypes.map((c) => (
                  <button
                    key={`c-${c}`}
                    onClick={() => removeChip('cuisineTypes', c)}
                    className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
                  >
                    <span className="capitalize">{c}</span>
                    <Icon name="X" size={12} />
                  </button>
                ))}
                {filters.rating && (
                  <button
                    onClick={() => removeChip('rating')}
                    className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
                  >
                    <Icon name="Star" size={12} className="text-warning fill-current" />
                    <span>{filters.rating}+</span>
                    <Icon name="X" size={12} />
                  </button>
                )}
                <button
                  onClick={clearAllFilters}
                  className="ml-1 px-2.5 py-1 text-xs text-error hover:underline"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        {/* List */}
        <RestaurantGrid
          selectedCategory={selectedCategory}
          selectedService={selectedService}
          appliedFilters={filters}
          searchQuery={searchQuery}
          centerCoords={fulfillment.coords}
          radiusMiles={radiusMiles}
          fulfillment={fulfillment}
        />
      </main>

      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        value={filters}
        onChange={setFilters}
        onReset={clearAllFilters}
        anchorRef={filterBtnRef}
        offset={{ x: 12, y: 8 }} 
      />
    </div>
  );
};

export default HomeRestaurantDiscovery;