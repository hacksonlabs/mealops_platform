import React from 'react';
import { createPortal } from 'react-dom';

function getInitials(str = '') {
  const parts = String(str).trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(p => p.charAt(0)).join('').toUpperCase() || '??';
}

/**
 * Reusable upward tooltip (fixed & portal).
 * Accepts `names` as array of strings or { name, role } objects.
 */
export default function PeopleTooltip({
  open,
  x,
  y,
  names = [],
  onMouseEnter,
  onMouseLeave,
  title = 'Attendees',
  width = 320, // base width; expands with number of role columns
  totalCount,
  extrasCount: extrasCountProp,
  unassignedCount: unassignedCountProp,
}) {
  if (!open) return null;
  // Normalize entries
  const entries = Array.isArray(names)
    ? names.map((item) =>
        typeof item === 'string'
          ? { name: item, role: undefined }
          : { name: item?.name ?? '', role: item?.role }
      )
    : [];

  // Derive extras/unassigned counts from props or fallback to parsing names
  const parsedExtras = entries.find((e) => /^extra\s*\(x\d+\)/i.test(String(e.name)))?.name;
  const parsedUnassigned = entries.find((e) => /^unassigned\s*\(x\d+\)/i.test(String(e.name)))?.name;
  const extrasCountFallback = parsedExtras ? Number(String(parsedExtras).match(/\(x(\d+)\)/i)?.[1] || 0) : 0;
  const unassignedCountFallback = parsedUnassigned ? Number(String(parsedUnassigned).match(/\(x(\d+)\)/i)?.[1] || 0) : 0;
  const extrasCount = typeof extrasCountProp === 'number' ? extrasCountProp : extrasCountFallback;
  const unassignedCount = typeof unassignedCountProp === 'number' ? unassignedCountProp : unassignedCountFallback;

  // Unique member count (exclude aggregate extras/unassigned rows)
  const isAggregateName = (n) => /^(extra|unassigned)\s*\(x\d+\)/i.test(String(n || ''));
  const uniqueMemberCount = entries.filter((e) => !isAggregateName(e.name)).length;
  const effectiveCount = totalCount != null ? totalCount : uniqueMemberCount;

  // Group by role when available
  const grouped = new Map(); // roleLabel -> array of display names
  for (const e of entries) {
    const n = String(e.name || '').trim();
    const isAggregate = /^extra\s*\(x\d+\)/i.test(n) || /^unassigned\s*\(x\d+\)/i.test(n);
    if (isAggregate || !n) continue; // handled in header or skip empties
    const role = String(e.role || '').trim();
    const roleKey = role ? role : 'Other';
    if (!grouped.has(roleKey)) grouped.set(roleKey, []);
    grouped.get(roleKey).push(n);
  }

  // Determine column count (one per role)
  let roleLabels = Array.from(grouped.keys());
  const hasRealRoles = roleLabels.some((k) => k !== 'Other');
  if (!hasRealRoles) roleLabels = [];
  // Order roles by common semantics, then alpha
  const weight = (r) => {
    const rl = r.toLowerCase();
    if (rl.includes('player')) return 0;
    if (rl.includes('coach')) return 1;
    if (rl.includes('staff')) return 2;
    return 3;
  };
  roleLabels.sort((a, b) => weight(a) - weight(b) || a.localeCompare(b));
  const columns = Math.max(1, roleLabels.length || 1);
  const colClass = columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-3' : 'grid-cols-4';
  const computedWidth = Math.max(width, Math.min(columns, 4) * 160);

  return createPortal(
    <div
      role="tooltip"
      className="z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg p-0"
      style={{
        position: 'fixed',
        left: x,
        top: y,
        transform: 'translate(-50%, calc(-100% - 8px))',
        width: computedWidth,
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
        {title} ({effectiveCount})
        {(extrasCount > 0 || unassignedCount > 0) && (
          <span className="ml-1">
            {extrasCount > 0 && ` + ${extrasCount} extra`}
            {unassignedCount > 0 && ` + ${unassignedCount} unassigned`}
          </span>
        )}
      </div>

      {/* Content: Role columns when roles present; otherwise simple list */}
      {roleLabels.length > 0 ? (
        <div className={`max-h-60 overflow-auto pr-1 grid ${colClass} gap-3 px-2 py-2`}>
          {roleLabels.map((role) => (
            <div key={role} className="min-w-0">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">{role}</div>
              <ul className="space-y-1">
                {grouped.get(role).map((displayName, idx) => (
                  <li key={`${role}-${idx}`} className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[9px] font-semibold shrink-0">
                      {getInitials(displayName)}
                    </div>
                    <div className="text-sm text-foreground truncate">{displayName}</div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="max-h-60 overflow-auto pr-1">
          {entries.map((e, idx) => (
            <li
              key={`${e.name || 'person'}-${idx}`}
              className="px-2 py-2 flex items-center gap-2 hover:bg-muted/40 rounded-md"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                {getInitials(e.name)}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate">
                  {e.name || 'Unnamed'}
                </div>
              </div>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="px-2 py-2 text-sm text-muted-foreground">No attendees.</li>
          )}
        </ul>
      )}
    </div>,
    document.body
  );
}
