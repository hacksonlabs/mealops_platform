import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

const TopPanel = ({
  upcomingMeals = [],
  onScheduleNew,
  onOrderClick,
}) => {
  const [expanded, setExpanded] = useState(false);

  const money = (n) =>
    (Number(n) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  const formatTime = (time) => {
    if (!time) return '';
    const [h, m = '00'] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatDay = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const statusBadge = (status) => {
    switch (status) {
      case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'confirmed': return 'text-green-600 bg-green-50 border-green-200';
      case 'completed': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const mealTypeIcon = (t) =>
    t === 'breakfast' ? 'Coffee' : t === 'dinner' ? 'UtensilsCrossed' : t === 'snack' ? 'Cookie' : 'Utensils';

  const LIMIT = 8;
  const hasMore = upcomingMeals.length > LIMIT;
  const list = expanded ? upcomingMeals : upcomingMeals.slice(0, LIMIT);

  const activate = (m) => onOrderClick && onOrderClick(m);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Upcoming */}
      <div className="lg:col-span-6 lg:col-start-4 self-stretch bg-card border border-border rounded-lg p-4 shadow-athletic">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-base font-heading font-semibold text-foreground">Upcoming Meals</h3>
          <span className="text-xs text-muted-foreground">Next 7 days</span>
        </div>

        <div className="relative">
          <div className={['overflow-y-auto transition-[max-height] duration-300', expanded ? 'max-h-[62vh]' : 'max-h-[34vh] lg:max-h-[300px]', 'pr-1'].join(' ')}>
            {list.length ? (
              <ul className="border border-border rounded-md divide-y divide-border">
                {list.map((m) => (
                  <li
                    key={m.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => activate(m)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        activate(m);
                      }
                    }}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
                  >
                    {/* col 1: icon + restaurant */}
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name={mealTypeIcon(m.mealType)} size={16} className="text-primary" />
                      <span className="text-sm font-medium text-foreground truncate">{m.restaurant}</span>
                    </div>

                    {/* col 2: date • time (desktop/tablet) */}
                    <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon name="Calendar" size={12} />
                      <span className="whitespace-nowrap">{formatDay(m.date)}</span>
                      <span className="opacity-60">•</span>
                      <span className="whitespace-nowrap">{formatTime(m.time)}</span>
                    </div>

                    {/* mobile: date • time under the restaurant */}
                    <div className="sm:hidden col-span-3 -mt-1 text-[12px] text-muted-foreground flex items-center gap-1">
                      <Icon name="Calendar" size={12} />
                      <span className="truncate">{formatDay(m.date)} • {formatTime(m.time)}</span>
                    </div>

                    {/* col 3: attendees */}
                    <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                      <Icon name="Users" size={12} />
                      <span>{m.attendees}</span>
                    </div>

                    {/* col 4: status */}
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium justify-self-end ${statusBadge(m.status)}`}>
                      {m.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-6">
                <Icon name="Calendar" size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming meals scheduled</p>
              </div>
            )}
          </div>

          {!expanded && hasMore && (
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-lg bg-gradient-to-t from-background to-transparent" />
          )}
        </div>

        <div className="mt-3 flex items-center justify-between">
          {hasMore ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              iconName={expanded ? 'ChevronUp' : 'ChevronDown'}
              iconSize={16}
            >
              {expanded ? 'Collapse' : `Show all (${upcomingMeals.length - LIMIT} more)`}
            </Button>
          ) : (
            <span className="text-xs text-transparent select-none">.</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopPanel;
