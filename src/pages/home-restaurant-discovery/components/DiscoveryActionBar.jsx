import React, { forwardRef } from 'react';
import Button from '@/components/ui/custom/Button';
import Icon from '@/components/AppIcon';

const DiscoveryActionBar = forwardRef(function DiscoveryActionBar(
  { activeCount, filters, onOpenFilters, onRemoveChip, onClearAll, summary },
  ref
) {
  return (
    <div className="bg-card border-b border-border">
      <div className="px-4 py-3 lg:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div ref={ref} className="inline-flex">
              <Button
                variant="outline"
                onClick={onOpenFilters}
                className="flex items-center space-x-2"
              >
                <Icon name="Filter" size={16} />
                <span className="text-sm">Filters</span>
                {activeCount > 0 && <div className="w-2 h-2 bg-primary" />}
              </Button>
            </div>
          </div>
          {summary && (
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {summary}
            </div>
          )}
        </div>

        {activeCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {(filters?.priceRange ?? []).map((p) => (
              <button
                key={`p-${p}`}
                onClick={() => onRemoveChip('priceRange', p)}
                className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
              >
                <span>{p}</span>
                <Icon name="X" size={12} />
              </button>
            ))}

            {(filters?.cuisineTypes ?? []).map((c) => (
              <button
                key={`c-${c}`}
                onClick={() => onRemoveChip('cuisineTypes', c)}
                className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
              >
                <span className="capitalize">{c}</span>
                <Icon name="X" size={12} />
              </button>
            ))}

            {filters?.rating && (
              <button
                onClick={() => onRemoveChip('rating')}
                className="px-2.5 py-1 text-xs border border-border bg-background rounded-none flex items-center gap-1 hover:bg-muted"
              >
                <Icon name="Star" size={12} className="text-warning fill-current" />
                <span>{filters.rating}+</span>
                <Icon name="X" size={12} />
              </button>
            )}

            <button
              onClick={onClearAll}
              className="ml-1 px-2.5 py-1 text-xs text-error hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default DiscoveryActionBar;
