import React from 'react';
import { cn } from '../../../utils/cn';
import Icon from '../../../components/AppIcon';

const LABELS = {
  grubhub: 'Grubhub',
  ubereats: 'Uber Eats',
  doordash: 'DoorDash',
};

function startCase(s = '') {
  return String(s)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

const ProviderToggle = ({
  providers = ['grubhub'],
  selected,
  onChange,
  disabled = false,
  showIcons = true,
  size = 'sm',
  className,
}) => {
  const btnSize =
    size === 'md'
      ? 'h-10 px-4 text-sm'
      : 'h-8 px-3 text-xs';

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border bg-card p-1 gap-1',
        className
      )}
      role="tablist"
      aria-label="Select ordering provider"
    >
      {providers.map((p) => {
        const val = String(p).toLowerCase();
        const isActive = val === String(selected).toLowerCase();
        const label = LABELS[val] || startCase(val);

        return (
          <button
            key={val}
            type="button"
            role="tab"
            aria-selected={isActive}
            disabled={disabled}
            onClick={() => !disabled && onChange?.(val)}
            className={cn(
              'flex items-center gap-2 rounded-md transition-colors',
              btnSize,
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-foreground hover:bg-muted'
            )}
          >
            {/* Icon is optional */}
            {showIcons && (
              <span className="inline-flex">
                {/* If you have specific icon names per provider, map them here.
                   This keeps things safe even if a mapping is missing. */}
                <Icon name="Store" size={14} />
              </span>
            )}
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ProviderToggle;
