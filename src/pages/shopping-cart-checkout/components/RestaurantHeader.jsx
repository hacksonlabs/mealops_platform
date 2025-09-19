// src/pages/checkout/components/RestaurantHeader.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';

const RestaurantHeader = ({
  restaurant,
  serviceType,
  onServiceTypeChange,
  estimatedTime, // (optional, kept for future use)
}) => {
  const name = restaurant?.name || 'Restaurant';
  const rating =
    Number.isFinite(Number(restaurant?.rating)) ? Number(restaurant.rating) : null;

  const tabBase =
    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';
  const activeTab = 'bg-primary text-primary-foreground shadow-sm';
  const inactiveTab = 'text-muted-foreground hover:text-foreground';

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-5">
      {/* One-row header: left (image + info) • right (toggle) */}
      <div className="flex items-center justify-between gap-4">
        {/* Left: image + name + meta */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div className="w-14 h-14 md:w-16 md:h-16 bg-muted rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-border">
            <img
              src={restaurant?.image}
              alt={name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/assets/images/no_image.png';
              }}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-semibold leading-tight text-foreground truncate">
                {name}
              </h1>

              {rating != null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
                  title={`${rating.toFixed(1)} rating`}
                >
                  <Icon name="Star" size={12} className="text-warning" />
                  <span className="tabular-nums">{rating.toFixed(1)}</span>
                </span>
              )}
            </div>

            {restaurant?.address ? (
              <div
                className="mt-0.5 text-xs text-muted-foreground truncate"
                title={restaurant.address}
              >
                {restaurant.address}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: compact segmented toggle */}
        <div
          className="inline-flex rounded-full border border-border bg-muted/60 p-0.5"
          role="tablist"
          aria-label="Service type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={serviceType === 'delivery'}
            onClick={() => onServiceTypeChange('delivery')}
            className={[tabBase, serviceType === 'delivery' ? activeTab : inactiveTab].join(' ')}
          >
            <Icon name="Truck" size={14} />
            Delivery
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={serviceType === 'pickup'}
            onClick={() => onServiceTypeChange('pickup')}
            className={[tabBase, serviceType === 'pickup' ? activeTab : inactiveTab].join(' ')}
          >
            <Icon name="ShoppingBag" size={14} />
            Pickup
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantHeader;
