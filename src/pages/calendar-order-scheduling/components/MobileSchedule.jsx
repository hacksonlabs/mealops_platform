import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';
import { getStatusBadge } from '../../../utils/ordersUtils';
import {
  bucketEventsByDay,
  buildContinuousDays,
  compareEvents,
  createInitialRange,
  extendRange,
  startOfDay,
} from '../utils/events';

const formatMobileTime = (time) => {
  if (!time) return '';
  const raw = String(time).trim();
  if (/\b(am|pm)\b/i.test(raw)) {
    return raw
      .replace(/\s+/g, ' ')
      .replace(/\b(am|pm)\b/gi, (match) => match.toUpperCase());
  }
  const parsed = new Date(time);
  if (!Number.isNaN(parsed.getTime())) {
    const hours = parsed.getHours();
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = (hours % 12) || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
  const match = /^([0-9]{1,2})(:?([0-9]{2}))?$/?.exec(raw);
  if (match) {
    const hours = Number(match[1]);
    const minutes = match[3] ?? '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHour = (hours % 12) || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
  return raw;
};

const formatDayHeading = (day) =>
  new Date(day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

const describeEvent = (event) => {
  if (event.type === 'birthday') {
    return {
      title: event.label || `${event.memberName}'s Birthday`,
      subtitle: '',
      badge: { variant: 'label', text: 'Birthday', className: 'bg-pink-50 text-pink-600 border border-pink-200' },
    };
  }
  if (event.type === 'cart') {
    return {
      title: event.label || 'Draft cart',
      subtitle: event.restaurant ? `Cart for ${event.restaurant}` : 'Review cart details',
      badge: { variant: 'label', text: 'Cart', className: 'bg-amber-50 text-amber-600 border border-amber-200' },
    };
  }
  return {
    title: event.restaurant || 'Meal order',
    subtitle: event.mealType ? `${event.mealType} • ${event.attendees || 0} people` : undefined,
    badge: { variant: 'status', status: event.status === 'confirmed' ? 'scheduled' : event.status },
  };
};

const MobileSchedule = ({ events = [], onSelectEvent, onSchedule, onLoadMore, loading, futureDays = 30 }) => {
  const listRef = useRef(null);
  const sentinelRef = useRef(null);
  const dayRefs = useRef({});
  const loadGuardRef = useRef({ pending: false, prevCount: events.length });
  const hasInteractedRef = useRef(false);
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = today.toISOString().slice(0, 10);
  const [range, setRange] = useState(() => createInitialRange(0, futureDays));
  const lastFutureDaysRef = useRef(futureDays);
  const prevEventsLengthRef = useRef(events.length);

  useEffect(() => {
    const last = lastFutureDaysRef.current;
    if (futureDays < last) {
      setRange(createInitialRange(0, futureDays));
      loadGuardRef.current = { pending: false, prevCount: events.length };
      hasInteractedRef.current = false;
    }
    lastFutureDaysRef.current = futureDays;
  }, [futureDays, events.length]);

  useEffect(() => {
    if (events.length === 0 && prevEventsLengthRef.current > 0) {
      setRange(createInitialRange(0, futureDays));
      loadGuardRef.current = { pending: false, prevCount: 0 };
      hasInteractedRef.current = false;
    }
    prevEventsLengthRef.current = events.length;
  }, [events.length, futureDays]);

  useEffect(() => {
    if (loadGuardRef.current.pending && events.length !== loadGuardRef.current.prevCount) {
      loadGuardRef.current.pending = false;
      loadGuardRef.current.prevCount = events.length;
    }
  }, [events.length]);

  const sortedEvents = useMemo(() => {
    const arr = [...(events || [])];
    arr.sort(compareEvents);
    return arr;
  }, [events]);

  const buckets = useMemo(() => bucketEventsByDay(sortedEvents), [sortedEvents]);
  const days = useMemo(() => buildContinuousDays(range.start, range.end, buckets), [range, buckets]);

  const requestMore = useCallback(() => {
    if (loadGuardRef.current.pending || !hasInteractedRef.current) return;
    loadGuardRef.current.pending = true;
    loadGuardRef.current.prevCount = events.length;
    setRange((prev) => extendRange(prev, { future: futureDays }));
    onLoadMore?.();
    hasInteractedRef.current = false;
  }, [events.length, onLoadMore, futureDays]);

  const handleScroll = useCallback((event) => {
    const el = event.currentTarget;
    hasInteractedRef.current = true;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      requestMore();
    }
  }, [requestMore]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            requestMore();
          } else if (loadGuardRef.current.pending) {
            loadGuardRef.current.pending = false;
          }
        });
      },
      {
        root: listRef.current ?? null,
        rootMargin: listRef.current ? '0px 0px 160px 0px' : '0px 0px 200px 0px',
        threshold: listRef.current ? 0.05 : 0,
      }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [requestMore]);

  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (initialScrollDone.current) return;
    const handle = requestAnimationFrame(() => {
      const target = dayRefs.current[todayKey];
      if (target && listRef.current) {
        const container = listRef.current;
        container.scrollTop = Math.max(target.offsetTop - container.clientHeight * 0.25, 0);
        initialScrollDone.current = true;
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [days, todayKey]);

  return (
    <div className="flex flex-col h-full">
      <Button
        onClick={onSchedule}
        iconName="Plus"
        iconPosition="left"
        className="w-full mb-4"
      >
        Schedule New Meal
      </Button>

      <div
        ref={listRef}
        className="flex-1 border border-border rounded-lg overflow-y-auto"
        onScroll={handleScroll}
        onPointerDown={() => { hasInteractedRef.current = true; }}
      >
        {loading && !events.length ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
        ) : days.length ? (
          <>
            <div className="divide-y divide-border">
              {days.map((day) => {
                const key = day.date.toISOString().slice(0, 10);
                return (
                  <div
                    key={key}
                    ref={(node) => {
                      if (node) dayRefs.current[key] = node;
                      else delete dayRefs.current[key];
                    }}
                    className="p-4 space-y-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{formatDayHeading(day.date)}</p>
                    </div>

                    {day.events.length ? (
                      day.events.map((event) => {
                        const meta = describeEvent(event);
                        return (
                          <button
                            key={event.id}
                            type="button"
                            className="w-full text-left p-4 border border-border rounded-md hover:bg-muted/50 transition-athletic"
                            onClick={() => onSelectEvent?.(event)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{meta.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatMobileTime(event.time)}
                                  {meta.subtitle ? ` • ${meta.subtitle}` : ''}
                                </p>
                              </div>
                              {meta.badge?.variant === 'status' && meta.badge.status && getStatusBadge(meta.badge.status)}
                              {meta.badge?.variant === 'label' && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.badge.className}`}>
                                  {meta.badge.text}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-md p-3">
                        No events scheduled
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div ref={sentinelRef} className="h-1" />
          </>
        ) : (
          <div className="text-center py-12">
            <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No events scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileSchedule;
