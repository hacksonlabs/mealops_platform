import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

const RestaurantHeader = ({ 
  restaurant, 
  serviceType, 
  onServiceTypeChange, 
  estimatedTime 
}) => {
  return (
    <div className="bg-card border-b border-border p-4 lg:p-6">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
          <img 
            src={restaurant?.image} 
            alt={restaurant?.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.src = '/assets/images/no_image.png';
            }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-foreground truncate">
            {restaurant?.name}
          </h1>
          <div className="flex items-center space-x-4 mt-2">
            <div className="flex items-center space-x-1">
              <Icon name="Star" size={14} className="text-warning fill-current" />
              <span className="text-sm font-medium">{restaurant?.rating}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Service Type Toggle */}
      <div className="flex bg-muted rounded-lg p-1">
        <Button
          variant={serviceType === 'delivery' ? 'default' : 'ghost'}
          onClick={() => onServiceTypeChange('delivery')}
          className="flex-1 justify-center"
        >
          <Icon name="Truck" size={16} className="mr-2" />
          Delivery
        </Button>
        <Button
          variant={serviceType === 'pickup' ? 'default' : 'ghost'}
          onClick={() => onServiceTypeChange('pickup')}
          className="flex-1 justify-center"
        >
          <Icon name="ShoppingBag" size={16} className="mr-2" />
          Pickup
        </Button>
      </div>
    </div>
  );
};

export default RestaurantHeader;