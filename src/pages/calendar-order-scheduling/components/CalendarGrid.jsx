import React, { useState } from 'react';


const CalendarGrid = ({ 
  currentDate, 
  selectedDate, 
  onDateSelect, 
  orders = [], 
  viewMode = '2weeks',
  onOrderClick 
}) => {
  const [hoveredDate, setHoveredDate] = useState(null);

  const labelFor = (o) => `${o?.time ?? ''} - ${o?.restaurant ?? ''}`;

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
  
  const EventLabel = ({ order }) => (
    <div className="truncate">
      <span className="text-[11px] sm:text-xs text-muted-foreground">{order?.time} - </span>
      <span className="text-sm sm:text-[13px] font-semibold text-foreground">{order?.restaurant}</span>
    </div>
  );

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
                    <div className="font-medium truncate">
                      <EventLabel order={order} />
                    </div>
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
                    <div className="text-xs mb-1">
                      <EventLabel order={order} />
                      <div className="text-muted-foreground text-center mt-0.5">
                        {order?.attendees} attendees
                      </div>
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

  const renderTwoWeekView = () => {
  const startOfWeek = (d, weekStartsOn = 0) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
    date.setDate(date.getDate() - diff);
    date.setHours(0, 0, 0, 0);
    return date;
  };

  // Anchor to currentDate so the grid doesn’t shift when selecting a day
  const anchor = new Date(currentDate);
  anchor.setHours(0, 0, 0, 0);

  const yesterday = new Date(anchor);
  yesterday.setDate(yesterday.getDate() - 1);

  const start = startOfWeek(yesterday, 0); // Sun-first, Sat last
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="relative isolate bg-card border border-border rounded-lg overflow-visible w-full">
      {/* DOW header */}
      <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
        {DOW.map((name) => (
          <div
            key={`hdr-${name}`}
            className="px-4 py-2 text-center text-sm font-medium text-muted-foreground uppercase tracking-wide"
          >
            {name}
          </div>
        ))}
      </div>

      {/* 14-day grid */}
      <div className="grid grid-cols-7 [grid-auto-rows:minmax(260px,1fr)] lg:[grid-auto-rows:minmax(300px,1fr)]">
        {days.map((date, i) => {
          const dayOrders = getOrdersForDate(date);
          const past = isPastDate(date);
          const selected = selectedDate ? isSameDate(date, selectedDate) : isToday(date);
          const inBottomRow = i >= 7;
          const col = i % 7;
          const isLeftEdge = col < 1;          // Sun
          const isRightEdge = col > 5;         // Sat
          const tooltipY = inBottomRow ? 'mt-2' : 'mt-2';
          const tooltipX = isLeftEdge
            ? 'left-4'
            : isRightEdge
            ? 'right-4'
            : 'left-1/2 -translate-x-1/2';

          return (
            <div
              key={date.toDateString()}
              aria-selected={selected}
              className={`relative overflow-visible p-4 border-r border-b border-border bg-card
                ${selected ? 'z-10 ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5' : ''}
                ${past ? 'opacity-90' : 'hover:bg-muted/40 cursor-pointer transition-athletic'}
              `}
              onClick={() => !past && onDateSelect?.(date)}
              onMouseEnter={() => setHoveredDate(date)}
              onMouseLeave={() => setHoveredDate(null)}
            >
              {/* date + quick action */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-base font-bold
                      ${selected ? 'bg-primary text-primary-foreground shadow' : isToday(date) ? 'text-primary' : 'text-foreground'}
                    `}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {!past && (
                  <button
                    type="button"
                    className="text-xs px-3 py-1 rounded-full border border-border bg-card shadow-sm inline-flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNewOrder?.(date);
                    }}
                  >
                    <span>+</span> New Order
                  </button>
                )}
              </div>

              {/* orders */}
              {dayOrders?.length > 0 && (
                <div className="space-y-2">
                  {dayOrders.slice(0, 3).map((order) => (
                    <div
                      key={order.id}
                      className={`text-xs px-2 py-1 rounded border ${getOrderStatusColor(order.status)} cursor-pointer`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOrderClick?.(order);
                      }}
                    >
                      <div className="font-medium truncate">{labelFor(order)}</div>
                    </div>
                  ))}
                  {dayOrders.length > 3 && (
                    <div className="text-xs text-muted-foreground px-2">
                      +{dayOrders.length - 3} more
                    </div>
                  )}
                </div>
              )}

              {/* Hover tooltip — open down on row 1, up on row 2; no clipping */}
              {hoveredDate && isSameDate(hoveredDate, date) && dayOrders?.length > 0 && (
                <div
                  className={`overflow-visible absolute ${tooltipY} ${tooltipX} z-40 pointer-events-none p-3 bg-popover border border-border rounded-md shadow-athletic-lg w-max max-w-[260px]`}>
                  <div className="font-semibold text-sm mb-2">
                    {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </div>
                  {dayOrders.map((order) => (
                    <div key={order.id} className="mb-1">
                      <div className="font-semibold text-[13px] leading-5 whitespace-normal break-words">
                        {(order.time ?? '') + ' - ' + (order.restaurant ?? '')}
                      </div>
                      <div className="text-muted-foreground text-xs text-center">
                        {order.attendees} attendees
                      </div>
                    </div>
                  ))}
                </div>
              )}


            </div>
          );
        })}
      </div>
    </div>
  );
};


  return (
    <div className="space-y-4">
      {viewMode === 'month' ? renderMonthView() : renderTwoWeekView()}
    </div>
  );
};

export default CalendarGrid;