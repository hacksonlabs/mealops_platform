import React, { useState } from 'react';
import { STATUS_META } from '../../../utils/ordersUtils';

const CalendarGrid = ({
  currentDate,
  selectedDate,
  onDateSelect,
  orders = [],          // orders + birthday events
  viewMode = '2weeks',
  onOrderClick,
  onNewOrder,
  attached = false,
  loading = false,
}) => {
  const [hoveredDate, setHoveredDate] = useState(null);
  // Midnight helper so "today" isn't considered past mid-day.
  const todayMidnight = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  };

  const labelFor = (o) =>
    o?.type === 'birthday'
      ? `🎂 ${o?.label ?? ''}`
      : o?.type === 'cart'
        ? `🛒 ${o?.time ?? ''} - ${o?.restaurant ?? o?.label ?? 'Draft Cart'}`
        : `${o?.time ?? ''} - ${o?.restaurant ?? o?.label ?? ''}`;

  const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const isToday = (date) => date.toDateString() === new Date().toDateString();
  const isPastDate = (date) => date < todayMidnight();
  const isSameDate = (a, b) => a?.toDateString() === b?.toDateString();
  const getEventsForDate = (d) => orders?.filter(o => isSameDate(new Date(o.date), d));
  const isPastEvent = (evt) => {
    const d = new Date(evt?.date);
    return Number.isFinite(d.getTime?.()) ? d < todayMidnight() : false;
  };
  const pastMod = (evt) => (isPastEvent(evt) ? 'opacity-60' : '');


  // consistent ordering — birthdays first, then by time, then label
  const eventSort = (a, b) => {
    const aB = a?.type === 'birthday';
    const bB = b?.type === 'birthday';
    if (aB !== bB) return aB ? -1 : 1; // birthdays on top

    const at = new Date(a?.date).getTime();
    const bt = new Date(b?.date).getTime();
    if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;

    const aLabel = (a?.restaurant ?? a?.label ?? '').toString();
    const bLabel = (b?.restaurant ?? b?.label ?? '').toString();
    return aLabel.localeCompare(bLabel);
  };

  const badgeFor = (evt) => {
    if (evt?.type === 'birthday') return 'bg-rose-50 text-rose-700 border-rose-200';
    const meta =
      STATUS_META[evt?.status] ??
      STATUS_META.scheduled ??
      { bg: 'bg-zinc-50', text: 'text-zinc-700', ring: 'ring-zinc-200' };
    const border = meta.ring?.replace(/^ring-/, 'border-') || 'border-transparent';
    return `${meta.bg} ${meta.text} ${border}`;
  };

  const EventLabel = ({ evt }) => (
    <div className="truncate">
      {evt?.type === 'birthday' ? (
        <span className="text-sm sm:text-[13px] font-semibold text-foreground">{labelFor(evt)}</span>
      ) : (
        <>
          <span className="text-[11px] sm:text-xs text-muted-foreground">{evt?.time} - </span>
          <span className="text-sm sm:text-[13px] font-semibold text-foreground">
            {evt?.restaurant ?? evt?.label}
          </span>
        </>
      )}
    </div>
  );

  // ----- Month view -----
  const renderMonthView = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const dayHeaders = dayNames.map((d) => (
      <div key={d} className="p-2 text-center text-sm font-medium text-muted-foreground border-b border-border">
        {d}
      </div>
    ));

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[120px] border-b border-r border-border bg-muted/30" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const dayEvents = getEventsForDate(date).slice().sort(eventSort);
      const isSelected = selectedDate && isSameDate(date, selectedDate);
      const isCurrentDay = isToday(date);
      const isPast = isPastDate(date);

      days.push(
        <div
          key={day}
          className={`min-h-[120px] border-b border-r border-border cursor-pointer transition-athletic
            ${isSelected ? 'bg-primary/10 ring-2 ring-primary' : 'hover:bg-muted/50'}
            ${isPast ? 'bg-muted/30 cursor-not-allowed' : ''}`}
          onClick={() => !isPast && onDateSelect?.(date)}
          onMouseEnter={() => setHoveredDate(date)}
          onMouseLeave={() => setHoveredDate(null)}
        >
          <div className="p-2">
            <div className={`text-sm font-medium mb-1
              ${isCurrentDay ? 'text-primary font-semibold' : ''}
              ${isPast ? 'text-muted-foreground' : 'text-foreground'}`}>
              {day}
            </div>

            {dayEvents?.length > 0 && (
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((evt) => (
                  <div
                    key={evt?.id}
                    className={`text-xs px-2 py-1 rounded border ${badgeFor(evt)} ${pastMod(evt)} ${evt?.type === 'birthday' ? 'cursor-pointer ring-1 ring-rose-200/60' : 'cursor-pointer'}`}
                    onClick={(e) => { e.stopPropagation(); onOrderClick?.(evt); }}
                  >
                    <div className="font-medium truncate"><EventLabel evt={evt} /></div>
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-muted-foreground px-2">+{dayEvents.length - 2} more</div>
                )}
              </div>
            )}

            {hoveredDate && isSameDate(hoveredDate, date) && dayEvents?.length > 0 && (
              <div className="absolute z-10 mt-2 p-3 bg-popover border border-border rounded-md shadow-athletic-lg min-w-[220px]">
                <div className="font-medium text-sm mb-2">
                  {date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                </div>
                {dayEvents.map((evt) => ( // already sorted
                  <div key={evt?.id} className="text-xs mb-1">
                    <EventLabel evt={evt} />
                    {evt?.type !== 'birthday' && (
                      <div className="text-muted-foreground text-center mt-0.5">{evt?.attendees} attendees</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    const monthWrapper = attached
      ? 'grid grid-cols-7 bg-card overflow-hidden'
      : 'grid grid-cols-7 border-l border-t border-border bg-card rounded-lg overflow-hidden';

    return (
      <div className={monthWrapper}>
        {dayHeaders}
        {days}
      </div>
    );
  };

  // ----- Two-week view -----
  const renderTwoWeekView = () => {
    const startOfWeek = (d, weekStartsOn = 0) => {
      const date = new Date(d);
      const day = date.getDay();
      const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;
      date.setDate(date.getDate() - diff);
      date.setHours(0,0,0,0);
      return date;
    };

    const anchor = new Date(currentDate); anchor.setHours(0,0,0,0);
    const yesterday = new Date(anchor); yesterday.setDate(yesterday.getDate() - 1);
    const start = startOfWeek(yesterday, 0);
    const days = Array.from({ length: 14 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });

    const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    const twoWeekWrapper = attached
      ? 'relative isolate bg-card overflow-visible w-full'
      : 'relative isolate bg-card border border-border rounded-lg overflow-visible w-full';

    return (
      <div className={twoWeekWrapper}>
        <div className="grid grid-cols-7 bg-muted/40 border-b border-border">
          {DOW.map((name) => (
            <div key={`hdr-${name}`} className="px-4 py-2 text-center text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 [grid-auto-rows:minmax(260px,1fr)] lg:[grid-auto-rows:minmax(300px,1fr)]">
          {days.map((date, i) => {
            const dayEvents = getEventsForDate(date).slice().sort(eventSort); // <<< SORT HERE
            const past = isPastDate(date);
            const selected = selectedDate ? isSameDate(date, selectedDate) : isToday(date);
            const col = i % 7;
            const isLeftEdge = col < 1;
            const isRightEdge = col > 5;
            const tooltipX = isLeftEdge ? 'left-4' : isRightEdge ? 'right-4' : 'left-1/2 -translate-x-1/2';

            return (
              <div
                key={date.toDateString()}
                aria-selected={selected}
                className={`relative overflow-visible p-4 border-r border-b border-border bg-card
                  ${selected ? 'z-10 ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/5' : ''}
                  ${past ? 'opacity-90' : 'hover:bg-muted/40 cursor-pointer transition-athletic'}`}
                onClick={() => !past && onDateSelect?.(date)}
                onMouseEnter={() => setHoveredDate(date)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full text-base font-bold
                      ${selected ? 'bg-primary text-primary-foreground shadow' : isToday(date) ? 'text-primary' : 'text-foreground'}`}>
                      {date.getDate()}
                    </span>
                  </div>

                  {!past && (
                    <button
                      type="button"
                      className="text-xs px-3 py-1 rounded-full border border-border bg-card shadow-sm inline-flex items-center gap-1"
                      onClick={(e) => { e.stopPropagation(); onNewOrder?.(date); }}
                    >
                      <span>+</span> New Order
                    </button>
                  )}
                </div>

                {dayEvents?.length > 0 && (
                  <div className="space-y-2">
                    {dayEvents.slice(0, 3).map((evt) => (
                      <div
                        key={evt.id}
                        className={`text-xs px-2 py-1 rounded border ${badgeFor(evt)} ${pastMod(evt)} cursor-pointer ${evt?.type === 'birthday' ? 'ring-1 ring-rose-200/60' : ''}`}
                        onClick={(e) => { e.stopPropagation(); onOrderClick?.(evt); }}
                      >
                        <div className="font-medium truncate">{labelFor(evt)}</div>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-2">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                )}

                {hoveredDate && isSameDate(hoveredDate, date) && dayEvents?.length > 0 && (
                  <div className={`overflow-visible absolute mt-2 ${tooltipX} z-40 pointer-events-none p-3 bg-popover border border-border rounded-md shadow-athletic-lg w-max max-w-[260px]`}>
                    <div className="font-semibold text-sm mb-2">
                      {date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}
                    </div>
                    {dayEvents.map((evt) => ( // already sorted
                      <div key={evt.id} className="mb-1">
                        <div className="font-semibold text-[13px] leading-5 whitespace-normal break-words">
                          {labelFor(evt)}
                        </div>
                        {evt?.type !== 'birthday' && (
                          <div className="text-muted-foreground text-xs text-center">{evt.attendees} attendees</div>
                        )}
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

  if (attached) return viewMode === 'month' ? renderMonthView() : renderTwoWeekView();
  return <div className="space-y-4">{viewMode === 'month' ? renderMonthView() : renderTwoWeekView()}</div>;
};

export default CalendarGrid;


