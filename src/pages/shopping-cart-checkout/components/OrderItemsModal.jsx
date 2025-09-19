// src/pages/checkout/components/OrderItemsModal.jsx
import React, { useMemo } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';

// NEW: shared helpers
import {
  expandItemsToUnitRows,
  sortAssigneeRows,
  addLineNumbers,
} from '../../../utils/cartDisplayUtils';

const OrderItemsModal = ({ open, onClose, items = [] }) => {
  if (!open) return null;

  // Locale-pinned collator for stable, cross-env sorting
  const collator = useMemo(
    () => new Intl.Collator('en', { sensitivity: 'base' }),
    []
  );

  // Build one row per UNIT using the shared utils
  const rows = useMemo(() => {
    const expanded = expandItemsToUnitRows(items || []);
    const sorted = sortAssigneeRows(expanded, collator);

    // Shape for this table + stable-ish keys
    const shaped = sorted.map((r, idx) => ({
      key: `${r.sourceId || 'i'}::${r.assignee || 'anon'}::${idx}`,
      assignee: r.assignee,
      item: r.itemName,
      customizations: r.customizations,
      special: r.special,
    }));

    return addLineNumbers(shaped);
  }, [items, collator]);

  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.currentTarget === e.target) onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[1200] bg-black/40 p-4 flex items-start md:items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-6xl bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
        role="dialog"
        aria-modal="true"
        aria-label="Cart details"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="List" size={18} />
            <h3 className="text-lg font-semibold">Cart Details</h3>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close">
            <Icon name="X" size={18} />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[70vh] overflow-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-[13px] md:text-sm border-collapse">
                <thead className="sticky top-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
                  <tr className="border-b border-border">
                    <th className="text-right py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide w-12">
                      #
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Assignee
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Item
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Customizations
                    </th>
                    <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">
                      Special requests
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={r.key}
                      className={`border-b border-border ${i % 2 ? 'bg-muted/20' : ''}`}
                    >
                      <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{r.lineNo}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-foreground">
                        {r.assignee}
                      </td>
                      <td className="py-2.5 px-3 text-foreground">{r.item}</td>
                      <td className="py-2.5 px-3">
                        {r.customizations ? (
                          <span className="italic text-foreground/90">{r.customizations}</span>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {r.special ? (
                          <span className="italic text-muted-foreground">{r.special}</span>
                        ) : (
                          <span className="text-muted-foreground/70">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 flex items-center justify-end">
          {/* <Button variant="outline" onClick={onClose}>Close</Button> */}
        </div>
      </div>
    </div>
  );
};

export default OrderItemsModal;
