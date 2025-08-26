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
  onFiltersChange,
  attached = false, 
}) => {
  const monthNames = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // const wrapper = attached
  //   ? 'p-4 space-y-4 border-b border-border'
  //   : 'bg-card border border-border rounded-lg p-4 space-y-4';

   const wrapper = attached
    ? 'p-4 space-y-4'
    : 'bg-card border border-border rounded-lg p-4 space-y-4';

  const formatRange = (start, end) => {
    const sameMonth = start.getMonth() === end.getMonth();
    const opts = { month: 'short', day: 'numeric' };
    return sameMonth
      ? `${start.toLocaleDateString('en-US', opts)} – ${end.getDate()}`
      : `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', opts)}`;
  };

  const handlePrevious = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else if (viewMode === 'twoWeeks') d.setDate(d.getDate() - 14);
    onDateChange(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else if (viewMode === 'twoWeeks') d.setDate(d.getDate() + 14);
    onDateChange(d);
  };

  const twoWeekLabel = (() => {
    if (viewMode !== 'twoWeeks') return '';
    const start = new Date(currentDate); start.setDate(start.getDate() - 1);
    const end = new Date(start); end.setDate(start.getDate() + 13);
    return formatRange(start, end);
  })();

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
    <div className={wrapper}>
      {/* Main Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* Date Navigation */}
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handlePrevious} iconName="ChevronLeft" iconSize={16}>
              Previous
            </Button>
            <div className="text-center min-w-[200px]">
              <h2 className="text-xl font-heading font-semibold text-foreground">
                {viewMode === 'month'
                  ? `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
                  : twoWeekLabel}
              </h2>
            </div>
            <Button variant="outline" size="sm" onClick={handleNext} iconName="ChevronRight" iconPosition="right" iconSize={16}>
              Next
            </Button>
          </div>
          <Button variant="secondary" size="sm" onClick={onTodayClick} iconName="Calendar" iconSize={16}>
            Today
          </Button>
        </div>
        {/* Legend */}
        {/* <div className="flex items-center space-x-4 text-xs">
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
        </div> */}

        {/* View toggle */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-muted rounded-md p-1">
            <button
              onClick={() => onViewModeChange('month')}
              className={`px-3 py-1 text-sm font-medium rounded transition-athletic ${
                viewMode === 'month' ? 'bg-card text-foreground shadow-athletic' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => onViewModeChange('twoWeeks')}
              className={`px-3 py-1 text-sm font-medium rounded transition-athletic ${
                viewMode === 'twoWeeks' ? 'bg-card text-foreground shadow-athletic' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              2 Weeks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;