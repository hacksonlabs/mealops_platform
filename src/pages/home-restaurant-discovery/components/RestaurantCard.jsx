import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/Button';

const RestaurantCard = ({ restaurant, selectedService = 'delivery', fulfillment }) => {
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(restaurant?.isFavorite || false);

  const handleCardClick = () => {
    navigate(`/restaurant/${restaurant?.id}?service=${selectedService}`, {
      state: { restaurant, fulfillment },
    });
  };

  // const handleFavoriteClick = (e) => {
  //   e?.stopPropagation();
  //   setIsFavorite(!isFavorite);
  // };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-card border border-border rounded-lg shadow-elevation-1 hover:shadow-elevation-2 transition-layout cursor-pointer overflow-hidden"
    >
      {/* Restaurant Image */}
      <div className="relative h-48 overflow-hidden">
        <Image
          src={restaurant?.image}
          alt={restaurant?.name}
          className="w-full h-full object-cover"
        />
        
        {/* Favorite Button */}
        {/* <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          className="absolute top-3 right-3 bg-white/90 hover:bg-white shadow-elevation-1 w-8 h-8"
        >
          <Icon 
            name="Heart" 
            size={16} 
            className={isFavorite ? 'text-error fill-current' : 'text-muted-foreground'} 
          />
        </Button> */}
      </div>
      {/* Restaurant Info */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold text-foreground truncate flex-1">
            {restaurant?.name}
          </h3>
          <div className="flex items-center space-x-1 ml-2">
            <Icon name="Star" size={14} className="text-warning fill-current" />
            <span className="text-sm font-medium text-foreground">
              {restaurant?.rating}
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
            <div className="flex items-center space-x-1">
              <Icon name="MapPin" size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">
                {restaurant?.distance}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-border">
          {/* <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e?.stopPropagation();
              console.log('View menu for:', restaurant?.name);
            }}
          >
            <Icon name="Menu" size={14} className="mr-1" />
            Menu
          </Button> */}
          
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e?.stopPropagation();
              navigate(`/restaurant/${restaurant?.id}?service=${selectedService}`, {
                state: { restaurant, fulfillment },
              });
            }}
          >
            <Icon name="ShoppingCart" size={14} className="mr-1" />
            Order
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;