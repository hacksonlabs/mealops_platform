import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const RestaurantHero = ({ restaurant, onServiceToggle, selectedService }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
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
        
        {/* Status Badge */}
        {/* <div className="absolute top-4 left-4">
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${
            restaurant?.isOpen 
              ? 'bg-success text-success-foreground' 
              : 'bg-error text-error-foreground'
          }`}>
            {restaurant?.isOpen ? 'Open' : 'Closed'}
          </div>
        </div> */}

        {/* Favorite Button */}
        {/* <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteToggle}
          className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm hover:bg-white/30"
        >
          <Icon 
            name={isFavorite ? "Heart" : "Heart"} 
            size={20} 
            className={isFavorite ? "text-error fill-current" : "text-white"}
          />
        </Button> */}
      </div>
      {/* Restaurant Info */}
      <div className="p-4 md:p-6 bg-card">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground leading-tight truncate max-w-[55%] md:max-w-[60%]">
            {restaurant?.name}
          </h1>

          {/* Cuisine */}
          {restaurant?.cuisine_type && (
            <>
              <span className="flex-none text-muted-foreground">•</span>
              <span className="flex-none text-sm md:text-base text-muted-foreground whitespace-nowrap">
                {restaurant?.cuisine_type}
              </span>
            </>
          )}

          {/* Rating + reviews */}
          {restaurant?.rating != null && (
            <>
              <span className="flex-none text-muted-foreground">•</span>
              <div className="flex items-center gap-1 flex-none whitespace-nowrap">
                <Icon name="Star" size={16} className="text-accent fill-current" />
                <span className="font-semibold">{restaurant?.rating}</span>
                {restaurant?.reviewCount != null && (
                  <span className="text-muted-foreground">({restaurant.reviewCount})</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>


    </div>
  );
};

export default RestaurantHero;