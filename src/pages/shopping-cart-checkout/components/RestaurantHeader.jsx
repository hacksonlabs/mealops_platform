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

  // Very compact on mobile, comfy on md+ screens
  const tabBase =
    'inline-flex items-center whitespace-nowrap rounded-full font-medium transition ' +
    // mobile (very small)
    'gap-1 px-2 py-1 text-[11px] ' +
    // tablet/desktop
    'md:gap-2 md:px-4 md:py-2 md:text-sm ' +
    // focus ring
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50';

  const activeTab = 'bg-primary text-primary-foreground shadow-sm';
  const inactiveTab = 'text-muted-foreground hover:text-foreground';

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-5">
      {/* On mobile we stack; on md+ we align left/right */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
        {/* Left: image + name + (address) */}
        <div className="flex items-center md:items-start gap-3 md:gap-4 min-w-0">
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
            {/* Name (+ rating on md+) */}
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-lg md:text-xl font-semibold leading-tight text-foreground truncate">
                {name}
              </h1>

              {rating != null && (
                // Hidden on mobile; inline badge on md+
                <span
                  className="hidden md:inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground"
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

        {/* Toggle:
            - Mobile: below address (because we stacked container); align left and add top margin
            - md+: on the right, vertically centered */}
        <div
          className="inline-flex rounded-full border border-border bg-muted/60 p-0.5 md:p-1.5 self-start md:self-auto mt-2 md:mt-0"
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
            {/* small icon on mobile, larger on md+ */}
            <span className="md:hidden"><Icon name="Truck" size={12} /></span>
            <span className="hidden md:inline"><Icon name="Truck" size={16} /></span>
            <span className="ml-1 md:ml-1.5">Delivery</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={serviceType === 'pickup'}
            onClick={() => onServiceTypeChange('pickup')}
            className={[tabBase, serviceType === 'pickup' ? activeTab : inactiveTab].join(' ')}
          >
            <span className="md:hidden"><Icon name="ShoppingBag" size={12} /></span>
            <span className="hidden md:inline"><Icon name="ShoppingBag" size={16} /></span>
            <span className="ml-1 md:ml-1.5">Pickup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantHeader;
