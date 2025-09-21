// src/pages/home-restaurant-discovery/components/RestaurantCard.jsx
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/custom/Button';

const RestaurantCard = React.memo(function RestaurantCard({
  restaurant,
  selectedService = 'delivery',
  fulfillment,
  initialCartTitle,
  mealType,
}) {
  const navigate = useNavigate();

  // Build target URL once
  const href = useMemo(() => {
    const id = restaurant?.id ?? '';
    return `/restaurant/${id}?service=${encodeURIComponent(selectedService)}`;
  }, [restaurant?.id, selectedService]);

  const goToRestaurant = useCallback(() => {
    const title = (initialCartTitle ?? '').trim();
    navigate(href, { state: { restaurant, fulfillment, initialCartTitle: title || undefined, mealType: mealType || undefined } });
  }, [navigate, href, restaurant, fulfillment, initialCartTitle, mealType]);

  const onKeyActivate = useCallback(
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        goToRestaurant();
      }
    },
    [goToRestaurant]
  );

  const rating =
    Number.isFinite(Number(restaurant?.rating))
      ? Number(restaurant.rating).toFixed(1)
      : null;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${restaurant?.name ?? 'restaurant'} details`}
      onClick={goToRestaurant}
      onKeyDown={onKeyActivate}
      className="bg-card border border-border rounded-lg shadow-elevation-1 hover:shadow-elevation-2 transition-layout cursor-pointer overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={restaurant?.image}
          alt={restaurant?.name || 'Restaurant'}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate flex-1">
            {restaurant?.name || 'Restaurant'}
          </h3>

          <div className="flex items-center space-x-1 ml-2">
            <Icon
              name="Star"
              size={14}
              className={rating ? 'text-warning fill-current' : 'text-muted-foreground'}
            />
            <span className="text-sm font-medium text-foreground">
              {rating ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              {restaurant?.reviewCount != null ? `(${restaurant.reviewCount})` : ''}
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
          {restaurant?.cuisine}
        </p>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            {restaurant?.distance && (
              <div className="flex items-center space-x-1">
                <Icon name="MapPin" size={14} className="text-muted-foreground" />
                <span className="text-muted-foreground">{restaurant.distance}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-border">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              goToRestaurant();
            }}
          >
            <Icon name="ShoppingCart" size={14} className="mr-1" />
            Order
          </Button>
        </div>
      </div>
    </div>
  );
});

export default RestaurantCard;