// src/components/ui/InfoTooltip.jsx
import React from 'react';
import { cn } from '../../utils/cn';
import Icon from '../AppIcon';

const InfoTooltip = ({ text, className, side = 'top' }) => {
  const sideClasses =
    side === 'bottom'
      ? 'top-full mt-2 -translate-x-1/2 left-1/2'
      : 'bottom-full mb-2 -translate-x-1/2 left-1/2';

  return (
    <span className={cn('relative inline-flex items-center group', className)}>
      {/* <button
        type="button"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground cursor-help focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="More info"
      > */}
        <Icon name="Info" size={13} className='pl-1'/>
      {/* </button> */}

      {/* Tooltip bubble */}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
          'absolute z-50 w-64 rounded-md border border-border bg-popover p-2 text-[11px] leading-snug text-popover-foreground shadow-md',
          'transition-opacity',
          sideClasses
        )}
      >
        {text}
      </span>
    </span>
  );
};

export default InfoTooltip;