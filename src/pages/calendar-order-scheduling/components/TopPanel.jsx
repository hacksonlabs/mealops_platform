import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const TopPanel = ({ 
  selectedDate, 
  upcomingMeals = [], 
  monthStats = { totalMeals: 0, totalSpent: 0, avgPerMeal: 0 },
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

  const money = (n) =>
    (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

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

   // ---------- HORIZONTAL STRIP (for top bar) ----------
  return (
    <div className="flex flex-col lg:flex-row lg:justify-center gap-6">
      {/* Upcoming Meals */}
      <div className="w-full lg:w-[520px] shrink-0 bg-card border border-border rounded-lg p-4 shadow-athletic">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-heading font-semibold text-foreground">Upcoming Meals</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Next 7 days</span>
            {/* <Button variant="outline" size="sm" onClick={onScheduleNew} iconName="Plus" iconSize={14}>
              Schedule
            </Button> */}
          </div>
        </div>

        {upcomingMeals?.length ? (
          <div className="space-y-2">
            {upcomingMeals.slice(0, 5).map((meal) => (
              <div key={meal.id} className="p-3 border border-border rounded-md hover:bg-muted/50 transition-athletic">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={getMealTypeIcon(meal.mealType)} size={16} className="text-primary" />
                    <div>
                      <div className="text-sm font-medium text-foreground">{meal.restaurant}</div>
                      <div className="text-xs text-muted-foreground capitalize">{meal.mealType}</div>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColor(meal.status)}`}>
                    {meal.status}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Icon name="Calendar" size={12} />
                      <span>{new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Icon name="Clock" size={12} />
                      <span>{formatTime(meal.time)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Icon name="Users" size={12} />
                    <span>{meal.attendees}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Icon name="Calendar" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming meals scheduled</p>
          </div>
        )}
      </div>

      {/* This Month — only 3 stats */}
      <div className="w-full lg:w-[520px] shrink-0 bg-card border border-border rounded-lg p-4 shadow-athletic">
        <h3 className="text-base font-heading font-semibold text-foreground mb-3">This Month</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border border-border rounded-md p-3">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="Calendar" size={16} className="text-blue-500" />
              <span className="text-foreground">Total Meals</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{monthStats.totalMeals}</div>
          </div>

          <div className="border border-border rounded-md p-3">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="DollarSign" size={16} className="text-green-600" />
              <span className="text-foreground">Total Spent</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{money(monthStats.totalSpent)}</div>
          </div>

          <div className="border border-border rounded-md p-3">
            <div className="flex items-center gap-2 text-sm">
              <Icon name="TrendingUp" size={16} className="text-purple-600" />
              <span className="text-foreground">Avg per Meal</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {money(monthStats.avgPerMeal)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopPanel;