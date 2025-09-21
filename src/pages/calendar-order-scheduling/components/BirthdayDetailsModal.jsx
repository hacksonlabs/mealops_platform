import React, { useEffect } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';

function calcAgeOn(dobISO, onISO) {
  const dob = new Date(dobISO);
  const on = new Date(onISO);
  let age = on.getFullYear() - dob.getFullYear();
  const m = on.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < dob.getDate())) age--;
  return age;
}

export default function BirthdayDetailsModal({ isOpen, onClose, event, onRemindCoaches }) {
  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  const age = event.dob ? calcAgeOn(event.dob, event.date) : null;

  // Only close when clicking the actual backdrop, not children
  const handleBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40"
      onMouseDown={handleBackdropMouseDown}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-card border border-border rounded-xl shadow-athletic-lg p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon name="Cake" size={20} />
            <h3 className="text-xl font-semibold text-foreground">Birthday</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 mb-4">
          <div className="text-rose-700 text-lg font-semibold">
            🎉 {event.memberName} {age !== null ? `turns ${age} today!` : `has a birthday today!`}
          </div>
          <div className="text-rose-700/80 mt-1">
            {new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Celebrate {event.memberName} with a quick team shout-out or a special treat.
        </p>

        {/* Actions
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button iconName="BellRing" onClick={() => onRemindCoaches?.(event)}>Remind all coaches</Button>
        </div>
        */}
      </div>
    </div>
  );
}
