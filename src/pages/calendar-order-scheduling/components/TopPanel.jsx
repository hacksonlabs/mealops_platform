import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';

const TopPanel = ({
  upcomingMeals = [],
  onScheduleNew,
  onOrderClick,
}) => {
  const UPCOMING_BATCH_SIZE = 5;
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [upcomingMeals.length]);

  const formatTime = (time) => {
    if (!time) return '';
    const raw = String(time).trim();

    // If the source already contains an AM/PM indicator, normalize spacing and casing only.
    if (/\b(am|pm)\b/i.test(raw)) {
      return raw
        .replace(/\s+/g, ' ')
        .replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
    }

    const [hoursPart, minutesPart = '00'] = raw.split(':');
    const hourNum = Number(hoursPart);
    if (!Number.isFinite(hourNum)) return raw;
    const minutes = minutesPart.slice(0, 2).padEnd(2, '0');
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = (hourNum % 12) || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDay = (iso) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const statusBadge = (status) => {
    const normalized = status === 'confirmed' ? 'scheduled' : status;
    switch (normalized) {
      case 'scheduled': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'completed': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const displayStatus = (status) => (status === 'confirmed' ? 'Scheduled' : status);

  const mealTypeIcon = (t) =>
    t === 'breakfast' ? 'Coffee' : t === 'dinner' ? 'UtensilsCrossed' : t === 'snack' ? 'Cookie' : 'Utensils';

  const totalMeals = upcomingMeals.length;
  const totalPages = Math.max(1, Math.ceil(totalMeals / UPCOMING_BATCH_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const startIndex = currentPage * UPCOMING_BATCH_SIZE;
  const visibleMeals = upcomingMeals.slice(startIndex, startIndex + UPCOMING_BATCH_SIZE);
  const canPrev = currentPage > 0;
  const canNext = currentPage < totalPages - 1 && totalMeals > 0;
  const rangeLabel = totalMeals === 0
    ? 'Showing 0 of 0'
    : `Showing ${startIndex + 1}-${Math.min(startIndex + UPCOMING_BATCH_SIZE, totalMeals)} of ${totalMeals}`;

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
          <div className="overflow-y-auto max-h-[34vh] lg:max-h-[300px] pr-1">
            {visibleMeals.length ? (
              <ul className="border border-border rounded-md divide-y divide-border">
                {visibleMeals.map((m) => (
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
                    {/* <span className={`text-xs px-2 py-0.5 rounded-full border font-medium justify-self-end ${statusBadge(m.status)}`}>
                      {displayStatus(m.status)}
                    </span> */}
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

        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <Button
            variant="outline"
            size="sm"
            iconName="ChevronLeft"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={!canPrev}
          >
            {/* Previous {UPCOMING_BATCH_SIZE} */}
          </Button>
          <span>{rangeLabel}</span>
          <Button
            variant="outline"
            size="sm"
            iconName="ChevronRight"
            onClick={() => setPage((prev) => (canNext ? prev + 1 : prev))}
            disabled={!canNext}
          >
            {/* Next {UPCOMING_BATCH_SIZE} */}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default TopPanel;
