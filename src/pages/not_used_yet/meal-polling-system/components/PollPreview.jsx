import React from 'react';
import Icon from '../../../../components/AppIcon';
import Button from '../../../../components/ui/custom/Button';

const PollPreview = ({ pollData }) => {
  const restaurantOptions = [
    { value: 'chipotle', label: 'Chipotle Mexican Grill' },
    { value: 'subway', label: 'Subway' },
    { value: 'panera', label: 'Panera Bread' },
    { value: 'olive-garden', label: 'Olive Garden' },
    { value: 'pizza-hut', label: 'Pizza Hut' },
    { value: 'kfc', label: 'KFC' },
    { value: 'taco-bell', label: 'Taco Bell' },
    { value: 'mcdonalds', label: 'McDonald\'s' }
  ];

  const getRestaurantName = (value) => {
    const restaurant = restaurantOptions?.find(r => r?.value === value);
    return restaurant ? restaurant?.label : value;
  };

  const formatMealTypes = (types) => {
    return types?.map(type => type?.charAt(0)?.toUpperCase() + type?.slice(1))?.join(', ');
  };

  const formatTargetAudience = (audience) => {
    switch (audience) {
      case 'all': return 'All Team Members';
      case 'players': return 'Players Only';
      case 'staff': return 'Staff Only';
      default: return audience;
    }
  };

  if (!pollData?.title) {
    return (
      <div className="bg-muted border border-border rounded-lg p-8 text-center">
        <Icon name="Eye" size={48} className="text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Poll Preview</h3>
        <p className="text-sm text-muted-foreground">
          Fill out the form above to see how your poll will appear to team members
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Icon name="Eye" size={20} className="text-primary" />
        <h3 className="text-lg font-heading font-semibold text-foreground">Poll Preview</h3>
      </div>
      <div className="bg-background border border-border rounded-lg p-6">
        {/* Poll Header */}
        <div className="mb-6">
          <h2 className="text-xl font-heading font-semibold text-foreground mb-2">
            {pollData?.title}
          </h2>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            {pollData?.mealTypes?.length > 0 && (
              <span className="flex items-center space-x-1">
                <Icon name="Utensils" size={16} />
                <span>{formatMealTypes(pollData?.mealTypes)}</span>
              </span>
            )}
            <span className="flex items-center space-x-1">
              <Icon name="Users" size={16} />
              <span>{formatTargetAudience(pollData?.targetAudience)}</span>
            </span>
            {pollData?.expirationDate && (
              <span className="flex items-center space-x-1">
                <Icon name="Clock" size={16} />
                <span>
                  Expires {pollData?.expirationDate}
                  {pollData?.expirationTime && ` at ${pollData?.expirationTime}`}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Custom Message */}
        {pollData?.customMessage && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm text-foreground">{pollData?.customMessage}</p>
          </div>
        )}

        {/* Restaurant Options */}
        {pollData?.restaurants?.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-medium text-foreground mb-4">
              Choose your preferred restaurant{pollData?.allowMultiple ? 's' : ''}:
            </h3>
            <div className="space-y-2">
              {pollData?.restaurants?.map((restaurantValue) => (
                <label
                  key={restaurantValue}
                  className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted cursor-pointer transition-athletic"
                >
                  <input
                    type={pollData?.allowMultiple ? "checkbox" : "radio"}
                    name="restaurant-preview"
                    className="w-4 h-4 text-primary border-border focus:ring-primary"
                    disabled
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">
                      {getRestaurantName(restaurantValue)}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Custom Suggestions */}
        {pollData?.allowSuggestions && (
          <div className="mt-6">
            <label className="block text-sm font-medium text-foreground mb-2">
              Suggest another restaurant (optional):
            </label>
            <input
              type="text"
              placeholder="Enter restaurant name..."
              className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              disabled
            />
          </div>
        )}

        {/* Submit Button */}
        <div className="mt-6 pt-4 border-t border-border">
          <Button variant="default" disabled fullWidth>
            Submit Vote
          </Button>
        </div>

        {/* Preview Notice */}
        <div className="mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Icon name="Info" size={16} className="text-accent" />
            <p className="text-xs text-accent">
              This is a preview. Team members will receive the actual poll via email and SMS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PollPreview;