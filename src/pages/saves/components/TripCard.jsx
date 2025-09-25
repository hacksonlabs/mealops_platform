import React, { useMemo } from 'react';
import Button from '@/components/ui/custom/Button';
import Icon from '@/components/AppIcon';
import { addressKindOptions, addressSideOptions, buildContactSummary, toTitleCase } from '../utils';

const TripCard = ({ trip, locations, onEditTrip, onDeleteTrip, onEditLocation }) => {
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-athletic-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-foreground">{toTitleCase(trip.trip_name)}</h4>
          {trip.description && (
            <p className="text-sm text-muted-foreground">{trip.description}</p>
          )}
          {trip.notes && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Notes:</span> {trip.notes}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            {linkedLocations.length === 0
              ? 'No addresses assigned yet.'
              : `${linkedLocations.length} address${linkedLocations.length === 1 ? '' : 'es'} assigned.`}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:flex-col sm:items-end">
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

      {linkedLocations.length > 0 && kindSummary.size > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {[...kindSummary.entries()].map(([label, count]) => (
            <span
              key={`${trip.id}-${label}`}
              className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1"
            >
              <Icon name="Flag" size={12} className="text-muted-foreground" />
              {label}
              <span className="text-muted-foreground/80">({count})</span>
            </span>
          ))}
        </div>
      )}

      {linkedLocations.length > 0 && (
        <div className="mt-4 space-y-3">
          {linkedLocations.map((location) => {
            const sideLabel =
              addressSideOptions.find((option) => option.value === location.address_side)?.label ||
              toTitleCase(location.address_side || '');
            const kindLabel =
              addressKindOptions.find((option) => option.value === location.address_kind)?.label ||
              toTitleCase(location.address_kind || '');
            const contactSummary = buildContactSummary(location);

            return (
              <div
                key={location.id}
                className="rounded-xl border border-border/60 bg-muted/30 p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      <span className="rounded-full bg-muted/60 px-2 py-0.5">{sideLabel}</span>
                      <span className="rounded-full bg-muted/60 px-2 py-0.5">{kindLabel}</span>
                      {location.organization_name && (
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-muted-foreground/80">
                          {location.organization_name}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold text-foreground">{toTitleCase(location.address_name)}</p>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Icon name="MapPin" size={14} className="mt-0.5 text-muted-foreground" />
                      <span>{location.formatted_address}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      iconName="Edit"
                      aria-label="Edit saved address"
                      onClick={() => onEditLocation(location)}
                    />
                  </div>
                </div>

                {contactSummary && (
                  <p className="text-xs uppercase tracking-wide text-muted-foreground/90">
                    <span className="font-semibold text-foreground">POC:</span> {contactSummary}
                  </p>
                )}

                {location.delivery_notes && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">Details:</span> {location.delivery_notes}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TripCard;
