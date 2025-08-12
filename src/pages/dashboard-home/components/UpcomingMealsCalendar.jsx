import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const UpcomingMealsCalendar = ({ upcomingMeals, onDateClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)?.getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1)?.getDay();
  };

  const formatMonth = (date) => {
    return date?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    newDate?.setMonth(currentDate?.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const getMealForDate = (day) => {
    const dateString = `${currentDate?.getFullYear()}-${String(currentDate?.getMonth() + 1)?.padStart(2, '0')}-${String(day)?.padStart(2, '0')}`;
    return upcomingMeals?.find(meal => meal?.date === dateString);
  };

  const isToday = (day) => {
    const today = new Date();
    return today?.getDate() === day && 
           today?.getMonth() === currentDate?.getMonth() && 
           today?.getFullYear() === currentDate?.getFullYear();
  };

  const isPastDate = (day) => {
    const today = new Date();
    const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    return checkDate < today?.setHours(0, 0, 0, 0);
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days?.push(
        <div key={`empty-${i}`} className="h-10 w-10"></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const meal = getMealForDate(day);
      const isCurrentDay = isToday(day);
      const isPast = isPastDate(day);

      days?.push(
        <button
          key={day}
          onClick={() => onDateClick && onDateClick(day, currentDate)}
          disabled={isPast}
          className={`
            h-10 w-10 rounded-lg text-sm font-medium transition-athletic relative
            ${isCurrentDay 
              ? 'bg-primary text-primary-foreground' 
              : isPast 
                ? 'text-muted-foreground cursor-not-allowed' 
                : 'text-foreground hover:bg-muted'
            }
            ${meal ? 'ring-2 ring-accent' : ''}
          `}
        >
          {day}
          {meal && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full"></div>
          )}
        </button>
      );
    }

    return days;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Upcoming Meals</h3>
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            iconName="ChevronLeft"
            onClick={() => navigateMonth(-1)}
          />
          <span className="text-sm font-medium text-foreground min-w-[120px] text-center">
            {formatMonth(currentDate)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            iconName="ChevronRight"
            onClick={() => navigateMonth(1)}
          />
        </div>
      </div>
      <div className="mb-4">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']?.map(day => (
            <div key={day} className="h-8 flex items-center justify-center">
              <span className="text-xs font-medium text-muted-foreground">{day}</span>
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-1">
          {renderCalendarDays()}
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center text-xs text-muted-foreground">
          <div className="w-3 h-3 bg-accent rounded-full mr-2"></div>
          <span>Scheduled meal</span>
        </div>
        
        {upcomingMeals?.slice(0, 3)?.map((meal) => (
          <div key={meal?.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
            <div className="flex items-center space-x-2">
              <Icon name="Calendar" size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {new Date(meal.date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-sm text-muted-foreground">{meal?.restaurant}</span>
            </div>
            <span className="text-xs text-muted-foreground">{meal?.time}</span>
          </div>
        ))}

        {upcomingMeals?.length > 3 && (
          <button className="w-full text-sm text-primary hover:text-primary/80 transition-athletic py-2">
            View {upcomingMeals?.length - 3} more meals
          </button>
        )}

        {upcomingMeals?.length === 0 && (
          <div className="text-center py-4">
            <Icon name="Calendar" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No upcoming meals scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UpcomingMealsCalendar;