
import React from 'react';
import Icon from '../components/AppIcon';

// --- Meal type helpers ---
export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch',     label: 'Lunch' },
  { value: 'dinner',    label: 'Dinner' },
  { value: 'snack',     label: 'Snack' },
  // { value: 'other',     label: 'Other' },
];

export const SERVICE_TYPES = [
  { value: 'delivery', label: 'Delivery', icon: 'Truck' },
  { value: 'pickup',   label: 'Pickup',   icon: 'Package' },
];

export const getMealTypeIcon = (mealType) => {
  const icons = {
    breakfast: 'Coffee',
    lunch: 'Utensils',
    dinner: 'UtensilsCrossed',
    snack: 'Cookie',
    other: 'Utensils'
  };
  return icons?.[mealType] || 'Utensils';
};

// --- Status helpers ---
export const STATUS_META = {
  draft:                { bg:'bg-amber-50',   text:'text-amber-700',   ring:'ring-amber-200',   icon:'Cart',     label:'Draft' },
  scheduled:            { bg:'bg-blue-50',   text:'text-blue-700',   ring:'ring-blue-200',   icon:'Calendar', label:'Scheduled' },
  pending_confirmation: { bg:'bg-amber-50',  text:'text-amber-700',  ring:'ring-amber-200',  icon:'Clock',   label:'Pending Confirmation', labelShort:'Pending' },
  preparing:            { bg:'bg-sky-50',    text:'text-sky-700',    ring:'ring-sky-200',    icon:'Loader',  label:'Preparing' },
  out_for_delivery:     { bg:'bg-indigo-50', text:'text-indigo-700', ring:'ring-indigo-200', icon:'Truck',   label:'Out for Delivery', labelShort:'On the way' },
  completed:            { bg:'bg-green-50',  text:'text-green-700',  ring:'ring-green-200',  icon:'Check',   label:'Completed' },
  cancelled:            { bg:'bg-red-50',    text:'text-red-700',    ring:'ring-red-200',    icon:'X',       label:'Cancelled' },
  failed:               { bg:'bg-red-50',    text:'text-red-700',    ring:'ring-red-200',    icon:'AlertTriangle', label:'Failed' },
  modified:             { bg:'bg-amber-50',  text:'text-amber-700',  ring:'ring-amber-200',  icon:'Pencil',  label:'Modified' },
};

export const getStatusBadge = (status) => {
  const meta = STATUS_META[status] || STATUS_META.scheduled;
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1',
        'text-[11px] font-semibold leading-none whitespace-nowrap select-none',
        'ring-1 ring-inset shadow-sm',
        meta.bg, meta.text, meta.ring, 'border-transparent'
      ].join(' ')}
      title={meta.label}
    >
      {meta.icon && <Icon name={meta.icon} size={12} />}
      <span className="sm:hidden">{meta.labelShort ?? meta.label}</span>
      <span className="hidden sm:inline">{meta.label}</span>
    </span>
  );
};

// --- Formatting helpers ---
export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date?.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  })?.format(amount ?? 0);
}
