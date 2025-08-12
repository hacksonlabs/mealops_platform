import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const CalendarHeader = ({ 
  currentDate, 
  onDateChange, 
  viewMode, 
  onViewModeChange,
  onTodayClick,
  filters,
  onFiltersChange 
}) => {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate?.setMonth(newDate?.getMonth() - 1);
    } else {
      newDate?.setDate(newDate?.getDate() - 7);
    }
    onDateChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate?.setMonth(newDate?.getMonth() + 1);
    } else {
      newDate?.setDate(newDate?.getDate() + 7);
    }
    onDateChange(newDate);
  };

  const mealTypes = [
    { value: 'all', label: 'All Meals' },
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'dinner', label: 'Dinner' },
    { value: 'snack', label: 'Snack' }
  ];

  const restaurants = [
    { value: 'all', label: 'All Restaurants' },
    { value: 'chipotle', label: 'Chipotle' },
    { value: 'subway', label: 'Subway' },
    { value: 'panera', label: 'Panera Bread' },
    { value: 'olive-garden', label: 'Olive Garden' },
    { value: 'local-deli', label: 'Local Deli' }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Main Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Date Navigation */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              iconName="ChevronLeft"
              iconSize={16}
            >
              Previous
            </Button>
            
            <div className="text-center min-w-[200px]">
              <h2 className="text-xl font-heading font-semibold text-foreground">
                {monthNames?.[currentDate?.getMonth()]} {currentDate?.getFullYear()}
              </h2>
              {viewMode === 'week' && (
                <p className="text-sm text-muted-foreground">
                  Week of {currentDate?.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              iconName="ChevronRight"
              iconPosition="right"
              iconSize={16}
            >
              Next
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={onTodayClick}
            iconName="Calendar"
            iconSize={16}
          >
            Today
          </Button>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-muted rounded-md p-1">
            <button
              onClick={() => onViewModeChange('month')}
              className={`
                px-3 py-1 text-sm font-medium rounded transition-athletic
                ${viewMode === 'month' ?'bg-card text-foreground shadow-athletic' :'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              Month
            </button>
            <button
              onClick={() => onViewModeChange('week')}
              className={`
                px-3 py-1 text-sm font-medium rounded transition-athletic
                ${viewMode === 'week' ?'bg-card text-foreground shadow-athletic' :'text-muted-foreground hover:text-foreground'
                }
              `}
            >
              Week
            </button>
          </div>
        </div>
      </div>
      {/* Filters */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center space-x-4">
          {/* Meal Type Filter */}
          <div className="flex items-center space-x-2">
            <Icon name="Utensils" size={16} className="text-muted-foreground" />
            <select
              value={filters?.mealType || 'all'}
              onChange={(e) => onFiltersChange({ ...filters, mealType: e?.target?.value })}
              className="text-sm border border-border rounded-md px-3 py-1 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {mealTypes?.map(type => (
                <option key={type?.value} value={type?.value}>
                  {type?.label}
                </option>
              ))}
            </select>
          </div>

          {/* Restaurant Filter */}
          <div className="flex items-center space-x-2">
            <Icon name="MapPin" size={16} className="text-muted-foreground" />
            <select
              value={filters?.restaurant || 'all'}
              onChange={(e) => onFiltersChange({ ...filters, restaurant: e?.target?.value })}
              className="text-sm border border-border rounded-md px-3 py-1 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {restaurants?.map(restaurant => (
                <option key={restaurant?.value} value={restaurant?.value}>
                  {restaurant?.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-muted-foreground">Scheduled</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-muted-foreground">Confirmed</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-gray-100 border border-gray-200 rounded"></div>
            <span className="text-muted-foreground">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;