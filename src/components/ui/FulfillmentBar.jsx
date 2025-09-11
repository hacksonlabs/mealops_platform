import React from 'react';
import Icon from '../AppIcon';
import Button from './Button';

const FulfillmentBar = ({ value, onChange, onUseCurrentLocation, className = '' }) => {
  const service = value?.service || 'delivery';
  const address = value?.address || '';
  const date = value?.date || '';
  const time = value?.time || '';

  const emit = (patch) => onChange?.({ ...value, ...patch });

  const useCurrentLocation = async () => {
    if (onUseCurrentLocation) {
      const res = await onUseCurrentLocation();
      if (res?.address || res?.coords) {
        emit({ address: res.address ?? address, coords: res.coords ?? null });
        return;
      }
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => emit({ coords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        () => {}
      );
    }
  };

  return (
    <div className={`bg-card border-b border-border ${className}`}>
      <div className="px-4 lg:px-6 pt-3">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 p-2 sm:p-3">
          {/* Service segmented toggle */}
          <div className="shrink-0">
            <div className="bg-muted/70 p-1 rounded-lg inline-flex">
              {[
                { id: 'delivery', label: 'Delivery', icon: 'Truck' },
                { id: 'pickup', label: 'Pickup', icon: 'Store' },
              ].map((opt) => {
                const active = service === opt.id;
                return (
                  <Button
                    key={opt.id}
                    variant={active ? 'default' : 'ghost'}
                    onClick={() => emit({ service: opt.id })}
                    className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 ${
                      active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon name={opt.icon} size={16} />
                    <span>{opt.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="hidden xl:block w-px self-stretch bg-border/60" />

          {/* Address */}
          <div className="flex-1 min-w-[240px]">
            <div className="relative h-11">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary">
                <Icon name="MapPin" size={16} />
              </span>
              <input
                type="text"
                value={address}
                onChange={(e) => emit({ address: e.target.value })}
                placeholder={service === 'delivery' ? 'Deliver to…' : 'Search near…'}
                className="h-11 w-full pl-9 pr-10 rounded-lg bg-muted/30 border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-sm"
                aria-label={service === 'delivery' ? 'Delivery address' : 'Pickup near address'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
              <button
                type="button"
                onClick={useCurrentLocation}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-md hover:bg-muted/60 text-muted-foreground flex items-center justify-center"
                title="Use current location"
              >
                <Icon name="Navigation" size={16} />
              </button>
            </div>
          </div>

          {/* Date */}
          <div className="w-full sm:w-auto sm:min-w-[190px]">
            <div className="relative h-11">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Icon name="Calendar" size={16} />
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => emit({ date: e.target.value })}
                className="h-11 w-full sm:w-[190px] pl-9 pr-3 rounded-lg bg-muted/30 border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-sm"
                aria-label="Date"
              />
            </div>
          </div>

          {/* Time */}
          <div className="w-full sm:w-auto sm:min-w-[160px]">
            <div className="relative h-11">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <Icon name="Clock" size={16} />
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => emit({ time: e.target.value })}
                className="h-11 w-full sm:w-[160px] pl-9 pr-3 rounded-lg bg-muted/30 border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent text-sm"
                aria-label="Time"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FulfillmentBar;