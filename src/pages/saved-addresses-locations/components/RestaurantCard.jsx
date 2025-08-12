import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const RestaurantCard = ({ restaurant, onToggleFavorite }) => {
  const getCuisineIcon = (cuisineType) => {
    const icons = {
      italian: 'UtensilsCrossed',
      chinese: 'Utensils',
      mexican: 'Utensils',
      american: 'Utensils',
      indian: 'Utensils',
      japanese: 'Utensils',
      mediterranean: 'UtensilsCrossed',
      thai: 'Utensils',
      other: 'Utensils'
    };
    return icons?.[cuisineType?.toLowerCase()] || 'Utensils';
  };

  const formatPhone = (phone) => {
    if (!phone) return null;
    // Basic phone formatting - you might want to use a proper phone formatting library
    const cleaned = phone?.replace(/\D/g, '');
    const match = cleaned?.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match?.[1]}) ${match?.[2]}-${match?.[3]}`;
    }
    return phone;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic hover:shadow-athletic-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name={getCuisineIcon(restaurant?.cuisine_type)} size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{restaurant?.name}</h3>
            <p className="text-sm text-muted-foreground">
              {restaurant?.cuisine_type ? 
                restaurant?.cuisine_type?.charAt(0)?.toUpperCase() + restaurant?.cuisine_type?.slice(1) : 
                'Restaurant'
              }
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleFavorite}
          iconName={restaurant?.is_favorite ? "Heart" : "HeartOff"}
          className={restaurant?.is_favorite ? "text-red-600 hover:text-red-700" : "text-muted-foreground"}
          title={restaurant?.is_favorite ? "Remove from favorites" : "Add to favorites"}
        />
      </div>

      {/* Location Info */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <Icon name="MapPin" size={16} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {restaurant?.location?.name}
          </span>
        </div>
      </div>

      {/* Contact Info */}
      {restaurant?.phone && (
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <Icon name="Phone" size={16} className="text-muted-foreground" />
            <span className="text-sm text-foreground">
              {formatPhone(restaurant?.phone)}
            </span>
          </div>
        </div>
      )}

      {/* Features */}
      <div className="flex flex-wrap gap-2 mb-4">
        {restaurant?.supports_catering && (
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-xs">
            <Icon name="Truck" size={12} className="mr-1" />
            Catering
          </span>
        )}
        {restaurant?.is_favorite && (
          <span className="inline-flex items-center px-2 py-1 rounded-md bg-red-100 text-red-800 text-xs">
            <Icon name="Heart" size={12} className="mr-1" />
            Favorite
          </span>
        )}
      </div>

      {/* Notes */}
      {restaurant?.notes && (
        <div className="mb-4">
          <div className="text-sm text-muted-foreground line-clamp-2 bg-muted p-3 rounded-lg">
            {restaurant?.notes}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            iconName="Phone"
            title="Call Restaurant"
            className="text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            iconName="ExternalLink"
            title="View Details"
            className="text-xs"
          />
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            iconName="RotateCcw"
            iconPosition="left"
            className="text-xs"
          >
            Quick Order
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;