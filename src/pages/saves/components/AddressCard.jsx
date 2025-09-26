import React from 'react';
import Button from '@/components/ui/custom/Button';
import Icon from '@/components/AppIcon';
import { addressKindOptions, addressSideOptions, buildContactSummary, toTitleCase } from '../utils';

const AddressCard = ({ location, trip, onEdit, onDelete }) => {
  const kindLabel = addressKindOptions.find((option) => option.value === location.address_kind)?.label || location.address_kind;
  const sideLabel = addressSideOptions.find((option) => option.value === location.address_side)?.label || location.address_side;
  const contactSummary = buildContactSummary(location);

  return (
    <div className="relative group">
      <div className="pointer-events-none absolute inset-x-4 bottom-[-18px] h-10 rounded-full bg-primary/20 blur-2xl opacity-0 transition duration-300 group-hover:opacity-60" />
      <div className="pointer-events-none absolute inset-x-8 bottom-[-26px] h-8 rounded-full bg-cyan-200/30 blur-3xl opacity-0 transition duration-300 group-hover:opacity-40" />
      <div className="pointer-events-none absolute inset-0 rounded-2xl border border-primary/30 opacity-0 transition duration-300 group-hover:opacity-60" />

      <div className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/25 px-5 py-4 shadow-[0_18px_32px_-24px_rgba(14,116,144,0.45)] flex flex-col gap-3 transition duration-300">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{sideLabel}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{kindLabel}</span>
              {trip && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{toTitleCase(trip.trip_name)}</span>
              )}
            </div>
            <h4 className="text-base font-semibold text-foreground">{toTitleCase(location.address_name)}</h4>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              iconName="Edit"
              onClick={() => onEdit(location)}
              aria-label="Edit saved address"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-error hover:text-error"
              iconName="Trash2"
              onClick={() => onDelete(location)}
              aria-label="Delete saved address"
            />
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Icon name="MapPin" size={14} className="mt-0.5 text-muted-foreground" />
            <span>{location.formatted_address}</span>
          </div>
          {location.delivery_notes && (
            <p className="text-sm leading-relaxed text-muted-foreground text-xs">
              <span className="font-semibold text-foreground text-xs">Delivery Notes:</span> {location.delivery_notes}
            </p>
          )}
          {contactSummary && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground/90">
              <span className="font-semibold text-foreground">POC:</span> {contactSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressCard;
