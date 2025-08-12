import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const SidebarPanel = ({ 
  selectedDate, 
  upcomingMeals = [], 
  savedTemplates = [],
  onTemplateUse,
  onScheduleNew 
}) => {
  const formatDate = (date) => {
    return date?.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (time) => {
    const [hours, minutes] = time?.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'confirmed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'completed':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getMealTypeIcon = (mealType) => {
    switch (mealType) {
      case 'breakfast':
        return 'Coffee';
      case 'lunch':
        return 'Utensils';
      case 'dinner':
        return 'UtensilsCrossed';
      case 'snack':
        return 'Cookie';
      default:
        return 'Utensils';
    }
  };

  return (
    <div className="space-y-6">
      {/* Selected Date Info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-3">
          Selected Date
        </h3>
        {selectedDate ? (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Icon name="Calendar" size={16} className="text-primary" />
              <span className="text-sm font-medium text-foreground">
                {formatDate(selectedDate)}
              </span>
            </div>
            <Button
              onClick={onScheduleNew}
              iconName="Plus"
              iconSize={16}
              className="w-full"
            >
              Schedule New Meal
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a date from the calendar to schedule a meal
          </p>
        )}
      </div>
      {/* Upcoming Meals */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            Upcoming Meals
          </h3>
          <span className="text-sm text-muted-foreground">
            Next 7 days
          </span>
        </div>
        
        {upcomingMeals?.length > 0 ? (
          <div className="space-y-3">
            {upcomingMeals?.slice(0, 5)?.map(meal => (
              <div
                key={meal?.id}
                className="p-3 border border-border rounded-md hover:bg-muted/50 transition-athletic cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Icon 
                      name={getMealTypeIcon(meal?.mealType)} 
                      size={16} 
                      className="text-primary" 
                    />
                    <span className="text-sm font-medium text-foreground">
                      {meal?.restaurant}
                    </span>
                  </div>
                  <span className={`
                    text-xs px-2 py-1 rounded-full border font-medium
                    ${getStatusColor(meal?.status)}
                  `}>
                    {meal?.status}
                  </span>
                </div>
                
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Icon name="Clock" size={12} />
                    <span>
                      {new Date(meal.date)?.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })} at {formatTime(meal?.time)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon name="Users" size={12} />
                    <span>{meal?.attendees} attendees</span>
                  </div>
                </div>
              </div>
            ))}
            
            {upcomingMeals?.length > 5 && (
              <div className="text-center pt-2">
                <Button variant="ghost" size="sm">
                  View All ({upcomingMeals?.length - 5} more)
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6">
            <Icon name="Calendar" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No upcoming meals scheduled
            </p>
          </div>
        )}
      </div>
      {/* Saved Templates */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-foreground">
            Quick Templates
          </h3>
          <Button variant="ghost" size="sm" iconName="Settings" iconSize={14}>
            Manage
          </Button>
        </div>
        
        {savedTemplates?.length > 0 ? (
          <div className="space-y-2">
            {savedTemplates?.map(template => (
              <div
                key={template?.id}
                className="p-3 border border-border rounded-md hover:bg-muted/50 transition-athletic"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-foreground mb-1">
                      {template?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {template?.restaurant} • {template?.mealType}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onTemplateUse(template)}
                    iconName="Play"
                    iconSize={14}
                  >
                    Use
                  </Button>
                </div>
                
                <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Icon name="Users" size={12} />
                    <span>{template?.members?.length || 0} people</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Icon name="Clock" size={12} />
                    <span>{formatTime(template?.time)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Icon name="BookOpen" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              No saved templates yet
            </p>
            <Button variant="outline" size="sm" iconName="Plus" iconSize={14}>
              Create Template
            </Button>
          </div>
        )}
      </div>
      {/* Quick Stats */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
          This Month
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon name="Calendar" size={16} className="text-blue-500" />
              <span className="text-sm text-foreground">Total Meals</span>
            </div>
            <span className="text-sm font-semibold text-foreground">24</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon name="DollarSign" size={16} className="text-green-500" />
              <span className="text-sm text-foreground">Total Spent</span>
            </div>
            <span className="text-sm font-semibold text-foreground">$2,840</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon name="TrendingUp" size={16} className="text-purple-500" />
              <span className="text-sm text-foreground">Avg per Meal</span>
            </div>
            <span className="text-sm font-semibold text-foreground">$118</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarPanel;