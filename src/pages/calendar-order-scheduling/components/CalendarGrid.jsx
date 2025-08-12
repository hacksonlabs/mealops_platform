import React, { useState } from 'react';


const CalendarGrid = ({ 
  currentDate, 
  selectedDate, 
  onDateSelect, 
  orders = [], 
  viewMode = 'month',
  onOrderClick 
}) => {
  const [hoveredDate, setHoveredDate] = useState(null);

  const getDaysInMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0)?.getDate();
  };

  const getFirstDayOfMonth = (date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1)?.getDay();
  };

  const isToday = (date) => {
    const today = new Date();
    return date?.toDateString() === today?.toDateString();
  };

  const isPastDate = (date) => {
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    return date < today;
  };

  const isSameDate = (date1, date2) => {
    return date1?.toDateString() === date2?.toDateString();
  };

  const getOrdersForDate = (date) => {
    return orders?.filter(order => 
      isSameDate(new Date(order.date), date)
    );
  };

  const getOrderStatusColor = (status) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Add day headers
    const dayHeaders = dayNames?.map(day => (
      <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border">
        {day}
      </div>
    ));

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days?.push(
        <div key={`empty-${i}`} className="min-h-[120px] border-b border-r border-border bg-muted/30"></div>
      );
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayOrders = getOrdersForDate(date);
      const isSelected = selectedDate && isSameDate(date, selectedDate);
      const isCurrentDay = isToday(date);
      const isPast = isPastDate(date);

      days?.push(
        <div
          key={day}
          className={`
            min-h-[120px] border-b border-r border-border cursor-pointer transition-athletic
            ${isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted/50'}
            ${isPast ? 'bg-muted/30 cursor-not-allowed' : ''}
          `}
          onClick={() => !isPast && onDateSelect(date)}
          onMouseEnter={() => setHoveredDate(date)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          <div className="p-2">
            <div className={`
              text-sm font-medium mb-1
              ${isCurrentDay ? 'text-primary font-semibold' : ''}
              ${isPast ? 'text-muted-foreground' : 'text-foreground'}
            `}>
              {day}
            </div>
            
            {dayOrders?.length > 0 && (
              <div className="space-y-1">
                {dayOrders?.slice(0, 2)?.map((order, index) => (
                  <div
                    key={order?.id}
                    className={`
                      text-xs px-2 py-1 rounded border cursor-pointer
                      ${getOrderStatusColor(order?.status)}
                    `}
                    onClick={(e) => {
                      e?.stopPropagation();
                      onOrderClick && onOrderClick(order);
                    }}
                  >
                    <div className="font-medium truncate">{order?.restaurant}</div>
                    <div className="text-xs opacity-75">{order?.time}</div>
                  </div>
                ))}
                {dayOrders?.length > 2 && (
                  <div className="text-xs text-muted-foreground px-2">
                    +{dayOrders?.length - 2} more
                  </div>
                )}
              </div>
            )}

            {/* Hover tooltip */}
            {hoveredDate && isSameDate(hoveredDate, date) && dayOrders?.length > 0 && (
              <div className="absolute z-10 mt-2 p-3 bg-popover border border-border rounded-md shadow-athletic-lg min-w-[200px]">
                <div className="font-medium text-sm mb-2">
                  {date?.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
                {dayOrders?.map(order => (
                  <div key={order?.id} className="text-xs mb-1">
                    <div className="font-medium">{order?.restaurant}</div>
                    <div className="text-muted-foreground">
                      {order?.time} • {order?.attendees} attendees
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-7 border-l border-t border-border bg-card rounded-lg overflow-hidden">
        {dayHeaders}
        {days}
      </div>
    );
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(selectedDate || currentDate);
    startOfWeek?.setDate(startOfWeek?.getDate() - startOfWeek?.getDay());
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date?.setDate(startOfWeek?.getDate() + i);
      weekDays?.push(date);
    }

    const timeSlots = [
      '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM',
      '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
      '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM'
    ];

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        {/* Week header */}
        <div className="grid grid-cols-8 border-b border-border">
          <div className="p-3 text-sm font-medium text-muted-foreground">Time</div>
          {weekDays?.map(date => (
            <div 
              key={date?.toISOString()} 
              className={`
                p-3 text-center border-l border-border
                ${isToday(date) ? 'bg-primary/5' : ''}
              `}
            >
              <div className="text-sm font-medium text-foreground">
                {date?.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`
                text-lg font-semibold
                ${isToday(date) ? 'text-primary' : 'text-foreground'}
              `}>
                {date?.getDate()}
              </div>
            </div>
          ))}
        </div>
        {/* Time slots */}
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots?.map(time => (
            <div key={time} className="grid grid-cols-8 border-b border-border min-h-[60px]">
              <div className="p-3 text-sm text-muted-foreground border-r border-border">
                {time}
              </div>
              {weekDays?.map(date => {
                const dayOrders = getOrdersForDate(date)?.filter(order => 
                  order?.time?.includes(time?.split(':')?.[0])
                );
                const isPast = isPastDate(date);
                
                return (
                  <div 
                    key={`${date?.toISOString()}-${time}`}
                    className={`
                      border-l border-border p-1 cursor-pointer hover:bg-muted/50 transition-athletic
                      ${isPast ? 'bg-muted/30 cursor-not-allowed' : ''}
                    `}
                    onClick={() => !isPast && onDateSelect(date)}
                  >
                    {dayOrders?.map(order => (
                      <div
                        key={order?.id}
                        className={`
                          text-xs p-1 rounded mb-1 cursor-pointer
                          ${getOrderStatusColor(order?.status)}
                        `}
                        onClick={(e) => {
                          e?.stopPropagation();
                          onOrderClick && onOrderClick(order);
                        }}
                      >
                        <div className="font-medium truncate">{order?.restaurant}</div>
                        <div className="opacity-75">{order?.attendees} people</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {viewMode === 'month' ? renderMonthView() : renderWeekView()}
    </div>
  );
};

export default CalendarGrid;