// src/pages/calendar-order-scheduling/components/OrderDetailsModal.jsx
import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import PeopleTooltip from '../../../components/ui/PeopleTooltip';
import { getStatusBadge, getMealTypeIcon } from '../../../utils/ordersUtils';

const OrderDetailsModal = ({ isOpen, onClose, order, onEdit, onCancel, onOpenDetail }) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Tooltip (attendees)
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [peoplePos, setPeoplePos] = useState({ x: 0, y: 0 });
  const peopleAnchorRef = useRef(null);
  if (!isOpen || !order) return null;

  const formatDate = (dateString) =>
    new Date(dateString)?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const formatTime = (time) => {
    const [hours, minutes] = (time || '').split(':');
    const hour = parseInt(hours || '0', 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes ?? '00'} ${ampm}`;
  };

  const memberEntries = Array.isArray(order.team_members) ? order.team_members : [];
  const extrasCount = Number(order.extrasCount ?? order.extras_count ?? 0) || 0;
  const unassignedCount = Number(order.unassignedCount ?? order.unassigned_count ?? 0) || 0;
  const attendeesCount = Number(order.attendeesTotal ?? (
    memberEntries.reduce((sum, m) => sum + (Number(m?.count) || 1), 0) + extrasCount + unassignedCount
  ));

  const peopleEntries = memberEntries.map((m, i) => ({
    name: m?.count && m.count > 1
      ? `${m?.name || `Member ${i + 1}`} (x${m.count})`
      : (m?.name || `Member ${i + 1}`),
    role: m?.role || '',
  }));
  if (extrasCount > 0) peopleEntries.push({ name: `Extra (x${extrasCount})` });
  if (unassignedCount > 0) peopleEntries.push({ name: `Unassigned (x${unassignedCount})` });

  const peopleNames = peopleEntries.map((p) => p.name);
  const peopleForTooltip = peopleEntries;
  const attendeeSummaryParts = [];
  if (extrasCount > 0) attendeeSummaryParts.push(`${extrasCount} extra${extrasCount === 1 ? '' : 's'}`);
  if (unassignedCount > 0) attendeeSummaryParts.push(`${unassignedCount} unassigned`);
  const attendeeSummary = attendeeSummaryParts.join(' • ');

  const canEdit = order?.status === 'scheduled' && new Date(order.date) > new Date();
  const canCancel = order?.status !== 'cancelled' && order?.status !== 'completed';

  const handleCancel = () => {
    onCancel?.(order?.id);
    setShowCancelConfirm(false);
    onClose?.();
  };
  const handleEdit = () => {
    onEdit?.(order);
    onClose?.();
  };

  const openPeople = () => {
    const el = peopleAnchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPeoplePos({ x: rect.left + rect.width / 2, y: rect.top });
    setPeopleOpen(true);
  };
  const closePeople = () => setPeopleOpen(false);

  const showDeliveryInstructions =
    order?.fulfillment_method === 'delivery' && !!order?.delivery_instructions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border">
          {/* Row 1: Title (left) | Meal type icon + Status + Close (right) */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-heading font-semibold text-foreground truncate flex-1">
              {order?.title || 'Meal'}
            </h2>
            <div className="flex items-center gap-2 shrink-0">
              <span className="p-2 bg-primary/10 rounded-lg inline-flex items-center justify-center">
                <Icon name={getMealTypeIcon(order?.mealType)} size={18} className="text-primary" />
              </span>
              {getStatusBadge(order?.status)}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                iconName="X"
                iconSize={20}
                aria-label="Close"
              />
            </div>
          </div>

          {/* Row 2: Restaurant */}
          <div className="mt-2 text-sm text-muted-foreground flex items-center gap-2 min-w-0">
            <Icon name="Store" size={14} className="text-muted-foreground shrink-0" />
            <span className="truncate">{order?.restaurant}</span>
          </div>

          {/* Row 3: Order number */}
          <div className="mt-1 text-sm text-muted-foreground">Order #{order?.id}</div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Date */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Date</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{formatDate(order?.date)}</p>
            </div>

            {/* Time */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon name="Clock" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Time</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">{formatTime(order?.time)}</p>
            </div>

            {/* Attendees */}
            <div className="space-y-1 col-span-2">
              <div className="flex items-center gap-2">
                <Icon name="Users" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Attendees</span>
              </div>
              <div className="pl-6">
                <span
                  ref={peopleAnchorRef}
                  onMouseEnter={openPeople}
                  onMouseLeave={closePeople}
                  className="inline-flex items-center gap-1 text-sm font-medium text-green-700 underline underline-offset-2 decoration-2 decoration-green-500 cursor-default"
                  title={peopleNames.join(', ')}
                >
                  <Icon name="Users" size={14} />
                  {attendeesCount} {attendeesCount === 1 ? 'meal' : 'meals'}
                </span>
                {attendeeSummary && (
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {attendeeSummary}
                  </div>
                )}
                <PeopleTooltip
                  open={peopleOpen}
                  x={peoplePos.x}
                  y={peoplePos.y}
                  names={peopleForTooltip}
                  totalCount={attendeesCount}
                  extrasCount={extrasCount}
                  unassignedCount={unassignedCount}
                  onMouseEnter={() => setPeopleOpen(true)}
                  onMouseLeave={closePeople}
                  title="Attendees"
                />
              </div>
            </div>

            {/* Delivery instructions (only for delivery) */}
            {showDeliveryInstructions && (
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2">
                  <Icon name="Truck" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Delivery Instructions</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6 whitespace-pre-wrap">
                  {order?.delivery_instructions}
                </p>
              </div>
            )}
          </div>

          {/* Created */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon name="History" size={16} className="text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Created</span>
            </div>
            <p className="text-sm text-muted-foreground pl-6">
              {new Date(order?.created_at)?.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenDetail?.(order.id)}
              iconName="Maximize2"
              iconSize={16}
            >
              View Full Details
            </Button>
          </div>

          {/* <div className="flex items-center space-x-2">
            {canCancel && !showCancelConfirm && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                iconName="X"
                iconSize={16}
              >
                Cancel Order
              </Button>
            )}

            {showCancelConfirm && (
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)}>
                  Keep Order
                </Button>
                <Button variant="destructive" size="sm" onClick={handleCancel}>
                  Confirm Cancel
                </Button>
              </div>
            )}

            {canEdit && (
              <Button variant="default" size="sm" onClick={handleEdit} iconName="Edit" iconSize={16}>
                Edit Order
              </Button>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;
