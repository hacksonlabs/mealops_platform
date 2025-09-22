import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/custom/Button';

const RestaurantHero = ({ restaurant, onServiceToggle, selectedService, rightContent, belowTitleContent }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
  };
  const fmt1 = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : '';
  };

  return (
    <div className="relative">
      {/* Restaurant Image */}
      <div className="relative h-48 md:h-64 overflow-hidden">
        <Image
          src={restaurant?.image}
          alt={restaurant?.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Restaurant Info row + right-side search */}
      <div className="p-4 md:p-6 bg-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          {/* Left: title/meta + below-title slot */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 md:gap-3 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight truncate max-w-full md:max-w-[60%]">
                {restaurant?.name}
              </h1>

              {(restaurant?.cuisine || restaurant?.cuisine_type) && (
                <>
                  <span className="flex-none text-muted-foreground">•</span>
                  <span className="flex-none text-sm md:text-base text-muted-foreground whitespace-nowrap">
                    {restaurant?.cuisine || restaurant?.cuisine_type}
                  </span>
                </>
              )}

              {restaurant?.rating != null && (
                <>
                  <span className="flex-none text-muted-foreground">•</span>
                  <div className="flex items-center gap-1 flex-none whitespace-nowrap">
                    <Icon name="Star" size={16} className="text-accent fill-current" />
                    <span className="font-semibold">{fmt1(restaurant.rating)}</span>
                    {restaurant?.reviewCount != null && (
                      <span className="text-muted-foreground">({restaurant.reviewCount})</span>
                    )}
                  </div>
                </>
              )}

              {restaurant?.distance && (
                <>
                  <span className="flex-none text-muted-foreground">•</span>
                  <div className="flex items-center gap-1 flex-none whitespace-nowrap">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span className="text-muted-foreground">{fmt1(restaurant.distance)}</span>
                  </div>
                </>
              )}
            </div>

            {/* renders directly under the title/meta */}
            {belowTitleContent && (
              <div className="mt-3">
                {belowTitleContent}
              </div>
            )}
          </div>

          {/* Right: inline search (from parent) */}
          {rightContent && <div className="w-full md:w-auto md:ml-4">{rightContent}</div>}
        </div>
      </div>
    </div>
  );
};

export default RestaurantHero;
