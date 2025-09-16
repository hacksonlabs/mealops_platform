import React, { useEffect } from 'react';
import RestaurantCard from './RestaurantCard';
import Icon from '@/components/AppIcon';
import { useRestaurantsSource, useDistances, useRestaurantFilters  } from '@/hooks/restaurant-discovery';

const RestaurantGrid = ({
  selectedCategory,
  selectedService,
  appliedFilters,
  searchQuery,
  centerCoords,
  radiusMiles = 3,
  fulfillment,
  onLoadingChange,
  suppressEmptyUntilLoaded = true,
  initialCartTitle
}) => {
  const { rows, setRows, loading, err, hasLoadedOnce } = useRestaurantsSource();
  const { distanceReady } = useDistances(centerCoords, rows, setRows);

  // Let parent know about effective loading
  const effectiveLoading = loading || (!!centerCoords && !distanceReady);
  useEffect(() => {
    onLoadingChange?.(effectiveLoading);
  }, [effectiveLoading, onLoadingChange]);

  const filtered = useRestaurantFilters(rows, {
    selectedCategory,
    appliedFilters,
    searchQuery,
    centerCoords,
    radiusMiles,
  });

  // Loading skeleton (prevents empty-state flash)
  if ((loading && rows.length === 0) || (!distanceReady && centerCoords)) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-card border border-border overflow-hidden">
              <div className="h-48 bg-muted animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted animate-pulse" />
                <div className="h-3 bg-muted animate-pulse" />
                <div className="h-3 bg-muted animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="px-4 py-12 lg:px-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-muted flex items-center justify-center mx-auto mb-4">
            <Icon name="AlertTriangle" size={24} className="text-error" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Couldn’t load restaurants</h3>
          <p className="text-muted-foreground mb-4">{err}</p>
        </div>
      </div>
    );
  }

  const showEmpty =
    (!suppressEmptyUntilLoaded || hasLoadedOnce) &&
    !loading &&
    filtered.length === 0;

  if (showEmpty) {
    return (
      <div className="px-4 py-12 lg:px-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Search" size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No restaurants found</h3>
          <p className="text-muted-foreground">Try expanding your radius or adjusting filters.</p>
        </div>
      </div>
    );
  }

  const fetchingOverlay =
    loading && hasLoadedOnce ? (
      <div className="pointer-events-none fixed inset-x-0 top-[var(--sticky-top,64px)] z-10 flex justify-center">
        <div className="mt-2 rounded-full px-3 py-1 text-xs bg-muted text-muted-foreground">Updating…</div>
      </div>
    ) : null;

  return (
    <div className="relative px-4 py-6 lg:px-6">
      {fetchingOverlay}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">
          {filtered.length} restaurants
        </h2>
        {centerCoords && (
          <div className="text-sm text-muted-foreground">within ~{radiusMiles} mi</div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((r) => (
          <RestaurantCard
            key={r.id}
            restaurant={r}
            selectedService={selectedService}
            fulfillment={fulfillment}
            initialCartTitle={initialCartTitle}
          />
        ))}
      </div>
    </div>
  );
};

export default RestaurantGrid;