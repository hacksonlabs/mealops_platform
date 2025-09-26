import React, { useMemo } from 'react';
import Button from '@/components/ui/custom/Button';
import Icon from '@/components/AppIcon';
import AddressCard from './AddressCard';
import { addressKindOptions, toTitleCase } from '../utils';

const TripCard = ({ trip, locations, onEditTrip, onDeleteTrip, onEditLocation, onDeleteLocation }) => {
  const { linkedLocations, kindSummary } = useMemo(() => {
    const linked = locations.filter((location) => location.trip_id === trip.id);
    const summary = linked.reduce((acc, location) => {
      const label =
        addressKindOptions.find((option) => option.value === location.address_kind)?.label ||
        toTitleCase(location.address_kind || '');
      if (!label) return acc;
      acc.set(label, (acc.get(label) || 0) + 1);
      return acc;
    }, new Map());
    return { linkedLocations: linked, kindSummary: summary };
  }, [locations, trip.id]);

  return (
    <div className="relative group">
      <div className="pointer-events-none absolute inset-x-6 bottom-[-22px] h-10 rounded-full bg-primary/20 blur-2xl opacity-0 transition duration-300 group-hover:opacity-60" />
      <div className="pointer-events-none absolute inset-x-10 bottom-[-30px] h-9 rounded-full bg-cyan-200/30 blur-3xl opacity-0 transition duration-300 group-hover:opacity-40" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/30 opacity-0 transition duration-300 group-hover:opacity-70" />

      <div className="relative rounded-2xl border border-border bg-card px-5 py-5 shadow-[0_20px_38px_-28px_rgba(14,116,144,0.45)] transition duration-300">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-lg font-semibold text-foreground">{toTitleCase(trip.trip_name)}</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Icon name="MapPin" size={12} />
                {linkedLocations.length === 0
                  ? 'No locations yet'
                  : `${linkedLocations.length} location${linkedLocations.length === 1 ? '' : 's'}`}
              </span>
            </div>

            <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
              {trip.description && (
                <div className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground/70">Summary</p>
                  <p className="mt-1 text-muted-foreground">{trip.description}</p>
                </div>
              )}
              {trip.notes && (
                <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-primary/70">Game Plan</p>
                  <p className="mt-1 text-primary/90">{trip.notes}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" iconName="Edit" onClick={() => onEditTrip(trip)}>
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconName="Trash2"
              className="text-error hover:text-error"
              onClick={() => onDeleteTrip(trip)}
            >
            </Button>
          </div>
        </div>

        {linkedLocations.length > 0 && (
          <div className="mt-1 space-y-3">
            {kindSummary.size > 0 && (
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {[...kindSummary.entries()].map(([label, count]) => (
                  <span
                    key={`${trip.id}-${label}`}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1"
                  >
                    {label}
                    <span className="text-muted-foreground/80">({count})</span>
                  </span>
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {linkedLocations.map((location) => (
                <AddressCard
                  key={location.id}
                  location={location}
                  trip={trip}
                  onEdit={onEditLocation}
                  onDelete={onDeleteLocation}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TripCard;
