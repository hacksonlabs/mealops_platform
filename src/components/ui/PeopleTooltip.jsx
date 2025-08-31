import React from 'react';
import { createPortal } from 'react-dom';

/**
 * Reusable upward tooltip (fixed & portal).
 * Position with viewport coords (x,y) — use getBoundingClientRect() from the trigger.
 */
export default function PeopleTooltip({
  open,
  x,
  y,
  names = [],
  onMouseEnter,
  onMouseLeave,
  title = 'Attendees',
  width = 320, // ~ w-80
}) {
  if (!open) return null;

  return createPortal(
    <div
      role="tooltip"
      className="z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-0"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 8px))', // always above the trigger
        width,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* caret */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -bottom-2"
        aria-hidden
      >
        <span
          className="block w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent"
          style={{ borderTopColor: 'hsl(var(--border))' }}
        />
        <span
          className="block w-0 h-0 -mt-[4px] border-l-7 border-r-7 border-t-7 border-l-transparent border-r-transparent"
          style={{ borderTopColor: 'hsl(var(--popover))' }}
        />
      </span>

      <div className="text-xs font-medium text-muted-foreground px-2 py-1">
        {title} ({names.length})
      </div>

      <ul className="max-h-60 overflow-auto pr-1">
        {names.map((name, idx) => (
          <li
            key={`${name}-${idx}`}
            className="px-2 py-2 flex items-center gap-2 hover:bg-muted/40 rounded-md"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
              {name
                .split(' ')
                .map((s) => s.charAt(0))
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="text-sm text-foreground truncate">{name}</div>
          </li>
        ))}
        {names.length === 0 && (
          <li className="px-2 py-2 text-sm text-muted-foreground">No attendees.</li>
        )}
      </ul>
    </div>,
    document.body
  );
}
