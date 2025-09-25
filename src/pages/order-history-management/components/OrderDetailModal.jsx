// /src/pages/order-history-management/components/OrderDetailModal.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';
import InfoTooltip from '../../../components/ui/InfoTooltip';
import Button from '../../../components/ui/custom/Button';
import {
  getStatusBadge,
  formatDate,
  formatCurrency,
  getMealTypeIcon,
} from '../../../utils/ordersUtils';

const titleCase = (s = '') =>
  String(s)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const normalizeRoleForCount = (role = '') => {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('coach')) return 'coach';
  if (value.includes('staff')) return 'staff';
  if (value.includes('player') || value.includes('athlete')) return 'player';
  return null;
};

const OrderDetailModal = ({ order, isOpen, onClose, onAction }) => {
  if (!isOpen || !order) return null;

  // Prefer normalized snapshot items. Support a few shapes defensively.
  const items = React.useMemo(
    () => order?.items || order?.orderItems || order?.meal_order_items || order?.meal_items || [],
    [order]
  );

  // Helpers to resolve assignee (for display + unique counting)
  const getAssigneeName = (it) =>
    it?.team_member?.full_name || // joined alias (team_members)
    it?.member?.name ||           // fallback from other shapes
    (it?.user_profile
      ? `${it.user_profile.first_name || ''} ${it.user_profile.last_name || ''}`.trim()
      : null);
  const normalizeExtraFlag = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const val = value.trim().toLowerCase();
      return val === 'true' || val === 't' || val === '1' || val === 'yes';
    }
    return false;
  };

  const isExtraItem = (item) => normalizeExtraFlag(item?.is_extra);

  // Sort line items for display:
  // 1) Assigned items (alphabetically by assignee name)
  // 2) Unassigned items
  // 3) Extras at the bottom
  const sortedItems = React.useMemo(() => {
    const list = [...(items || [])];
    const key = (s) => String(s || '').trim().toLowerCase();
    list.sort((a, b) => {
      const aAssignee = getAssigneeName(a);
      const bAssignee = getAssigneeName(b);
      const aExtra = isExtraItem(a);
      const bExtra = isExtraItem(b);

      const aCat = aExtra ? 2 : (aAssignee ? 0 : 1);
      const bCat = bExtra ? 2 : (bAssignee ? 0 : 1);
      if (aCat !== bCat) return aCat - bCat;

      // Within assigned, sort by assignee name
      if (aCat === 0) {
        const cmpAssignee = key(aAssignee).localeCompare(key(bAssignee));
        if (cmpAssignee !== 0) return cmpAssignee;
      }

      // Fallback: sort by item name
      const cmpItem = key(a?.name).localeCompare(key(b?.name));
      if (cmpItem !== 0) return cmpItem;

      // Final tie-breaker: by id
      return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
    return list;
  }, [items]);

  const getAssigneeKey = (it) =>
    it?.team_member_id ||
    it?.user_id ||
    it?.team_member?.id ||
    it?.user_profile?.id ||
    getAssigneeName(it) || null;

  const assignmentStats = React.useMemo(() => {
    const memberMap = new Map();
    let extrasCount = 0;
    let unassignedCount = 0;
    let assignedUnits = 0;
    let totalUnits = 0;
    const roleCounts = { player: 0, coach: 0, staff: 0 };

    (items || []).forEach((it) => {
      const qty = Math.max(1, Number(it?.quantity ?? 1));
      totalUnits += qty;

      if (isExtraItem(it)) {
        extrasCount += qty;
        return;
      }

      const name = getAssigneeName(it);
      if (name) {
        assignedUnits += qty;
        memberMap.set(name, (memberMap.get(name) || 0) + qty);

        const roleRaw =
          it?.team_member?.role ||
          it?.member?.role ||
          it?.team_member_role ||
          it?.role ||
          '';
        const normalizedRole = normalizeRoleForCount(roleRaw);
        if (normalizedRole) roleCounts[normalizedRole] += qty;
      } else {
        unassignedCount += qty;
      }
    });

    const memberEntries = Array.from(memberMap.entries());
    const memberNames = memberEntries.map(([name, count]) =>
      count > 1 ? `${name} (x${count})` : name
    );

    const attendeeTotal = totalUnits || (assignedUnits + extrasCount + unassignedCount);

    const assignedBreakdown = [];
    if (assignedUnits > 0) assignedBreakdown.push(`${assignedUnits} assigned`);
    if (extrasCount > 0) assignedBreakdown.push(`${extrasCount} extra${extrasCount === 1 ? '' : 's'}`);
    if (unassignedCount > 0) assignedBreakdown.push(`${unassignedCount} unassigned`);

    const roleBreakdown = [];
    if (roleCounts.player > 0) roleBreakdown.push(`${roleCounts.player} player${roleCounts.player === 1 ? '' : 's'}`);
    if (roleCounts.coach > 0) roleBreakdown.push(`${roleCounts.coach} ${roleCounts.coach === 1 ? 'coach' : 'coaches'}`);
    if (roleCounts.staff > 0) roleBreakdown.push(`${roleCounts.staff} staff`);

    const fullBreakdown = [
      ...roleBreakdown,
      ...(extrasCount > 0 ? [`${extrasCount} extra${extrasCount === 1 ? '' : 's'}`] : []),
      ...(unassignedCount > 0 ? [`${unassignedCount} unassigned`] : []),
    ];

    return {
      memberNames,
      extrasCount,
      unassignedCount,
      attendeeTotal,
      assignedCount: assignedUnits,
      roleCounts,
      assignedBreakdown,
      roleBreakdown,
      fullBreakdown,
    };
  }, [items]);

  const mealType = order?.meal_type || 'other';
  const fulfillment = (order?.fulfillment_method || '').toLowerCase();
  const isDelivery = fulfillment === 'delivery';

  const restaurantName = order?.restaurant?.name || '—';
  const restaurantAddr = order?.restaurant?.address || '';

  const childOrders = Array.isArray(order?.suborders)
    ? order.suborders
    : [];
  const childOrderNumbers = childOrders.length
    ? childOrders.map((co) => co.orderNumber).filter(Boolean)
    : Array.isArray(order?.child_order_numbers)
      ? order.child_order_numbers
      : [];
  const childOrderLabels = childOrderNumbers.map((n) => `#${n}`).join(', ');
  const isSplitParent = Boolean(order?.is_split_parent) && childOrderNumbers.length > 0;
  const parentOrderNumber = order?.api_order_id || order?.orderNumber || `ORD-${String(order?.id || '').substring(0, 8)}`;
  const scheduledDateTime = order?.scheduled_date ? formatDate(order?.scheduled_date) : null;

  // Location rule: delivery => per-order destination; else => restaurant address
  const deliveryAddress = [
    order?.delivery_address_line1 || '',
    order?.delivery_address_line2 || '',
    [order?.delivery_city, order?.delivery_state, order?.delivery_zip].filter(Boolean).join(', ')
  ]
    .filter(Boolean)
    .join(', ');
  const locationStr = isDelivery ? deliveryAddress : restaurantAddr;

  const paymentMethod = order?.payment_method || null;

  // Render helpers for item pricing (support cents or float)
  const getUnitPrice = (it) => {
    const cents =
      it?.product_marked_price_cents ??
      it?.unitPriceCents ??
      (typeof it?.price === 'number' ? Math.round(it.price * 100) : 0);
    return cents / 100;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-card rounded-lg shadow-athletic-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="p-4 sm:p-6 border-b border-border">
            {/* Mobile header */}
            <div className="sm:hidden relative flex flex-col gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                iconName="X"
                className="absolute top-0 right-0"
              />

              <div className="flex items-start gap-3 pr-8">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                  <Icon name="ClipboardList" size={20} className="text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-heading font-semibold text-foreground">Order Details</h2>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Icon name={getMealTypeIcon(mealType)} size={14} className="text-muted-foreground" title={mealType} />
                    <span className="capitalize">{mealType}</span>
                    <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                      {fulfillment ? titleCase(fulfillment) : '—'}
                    </span>
                    {getStatusBadge(order?.order_status)}
                  </div>
                </div>
              </div>
              {!isSplitParent && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {scheduledDateTime && <p>{scheduledDateTime}</p>}
                  <p>Order #{parentOrderNumber}</p>
                </div>
              )}
              {isSplitParent && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {scheduledDateTime && <p>{scheduledDateTime}</p>}
                  {childOrderLabels && <p>Orders: {childOrderLabels}</p>}
                </div>
              )}
            </div>

            {/* Desktop header */}
            <div className="hidden sm:flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <Icon name="ClipboardList" size={24} className="text-primary-foreground" />
                </div>
                <div>
                  <h2 className="text-xl font-heading font-semibold text-foreground pb-0.5">Order Details</h2>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    {!isSplitParent && (
                      <>
                        {scheduledDateTime && <p>{scheduledDateTime}</p>}
                        <p>Order #{parentOrderNumber}</p>
                        
                      </>
                    )}
                    {isSplitParent && (
                      <>
                        {scheduledDateTime && <p>{scheduledDateTime}</p>}
                        {childOrderLabels && <p>Orders: {childOrderLabels}</p>}
                       
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground capitalize">
                  {fulfillment ? titleCase(fulfillment) : '—'}
                </span>
                <Icon
                  name={getMealTypeIcon(mealType)}
                  size={16}
                  className="text-muted-foreground"
                  title={mealType}
                />
                {getStatusBadge(order?.order_status)}
                <Button variant="ghost" size="sm" onClick={onClose} iconName="X" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6 pb-6 space-y-5 sm:space-y-6">
              {/* Order Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-muted rounded-lg p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon name="Store" size={14} className="text-muted-foreground" />
                    <span className="text-[13px] sm:text-sm font-medium text-foreground">Restaurant</span>
                  </div>
                  <p className="text-sm sm:text-lg font-semibold text-foreground leading-snug">{restaurantName}</p>
                  {restaurantAddr && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{restaurantAddr}</p>
                  )}
                </div>

                <div className="bg-muted rounded-lg p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon name="MapPin" size={14} className="text-muted-foreground" />
                    <span className="text-[13px] sm:text-sm font-medium text-foreground">
                      {isDelivery ? 'Deliver to' : 'Pickup from'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">
                    {locationStr || '—'}
                  </p>
                  {!!order?.delivery_instructions && isDelivery && (
                    <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
                      {order.delivery_instructions}
                    </p>
                  )}
                </div>

              <div className="bg-muted rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Icon name="Users" size={14} className="text-muted-foreground" />
                  <span className="text-[13px] sm:text-sm font-medium text-foreground">Attendees</span>
                </div>
                <p className="text-base sm:text-lg font-semibold text-foreground">{assignmentStats.attendeeTotal}</p>
                {assignmentStats.fullBreakdown.length > 0 && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    <div>{assignmentStats.fullBreakdown.join(' + ')}</div>
                  </div>
                )}
              </div>

              <div className="bg-muted rounded-lg p-3 sm:p-4">
                <div className="flex items-center gap-1 mb-1.5">
                  <Icon name="DollarSign" size={14} className="text-muted-foreground" />
                  <span className="text-[13px] sm:text-sm font-medium text-foreground">Total Cost</span>
                  <InfoTooltip text="This includes all the taxes + fees" />
                </div>
                <p className="text-base sm:text-lg font-semibold text-foreground">
                  {formatCurrency(order?.total_amount)}
                </p>
              </div>
            </div>

              {/* Line Items (with assigned member) */}
              <div>
                <div className="bg-muted rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-card">
                        <tr>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">
                            Assigned To
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">
                            Item
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-left text-xs sm:text-sm font-medium text-foreground">
                            Special Requests
                          </th>
                          <th className="px-3 sm:px-4 py-3 text-right text-xs sm:text-sm font-medium text-foreground">
                            Price
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(sortedItems ?? []).map((it) => {
                          const unit = getUnitPrice(it);
                          const assignee = getAssigneeName(it);
                          const specialRequests = (it?.notes || '').trim();
                          return (
                            <tr key={it.id} className="hover:bg-card/50 transition-athletic">
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-secondary rounded-full flex items-center justify-center">
                                    <Icon name="User" size={12} className="text-secondary-foreground" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate font-medium">
                                      {isExtraItem(it) ? 'Extra' : assignee || 'Unassigned'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-foreground">
                                <div className="font-medium text-foreground">{it?.name}</div>
                                {it?.description && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                    {it.description}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm text-muted-foreground">
                                {specialRequests ? specialRequests : '—'}
                              </td>
                              <td className="px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-foreground text-right">
                                {formatCurrency(unit)}
                              </td>
                            </tr>
                          );
                        })}
        {(!items || items.length === 0) && (
          <tr>
            <td
              colSpan={4}
              className="px-3 sm:px-4 py-6 text-xs sm:text-sm text-muted-foreground text-center"
            >
              No line items recorded for this order.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
</div>
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="text-base sm:text-lg font-heading font-semibold text-foreground mb-3 sm:mb-4">
                  Payment Information
                </h3>
                <div className="bg-muted rounded-lg p-3 sm:p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon name="CreditCard" size={14} className="text-muted-foreground" />
                        <span className="text-[13px] sm:text-sm font-medium text-foreground">
                          Payment Method
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-foreground">
                        {paymentMethod?.card_name && paymentMethod?.last_four
                          ? `${paymentMethod.card_name} (**** ${paymentMethod.last_four})`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Icon name="Receipt" size={14} className="text-muted-foreground" />
                        <span className="text-[13px] sm:text-sm font-medium text-foreground">Receipt</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAction('receipt', order)}
                        iconName="Download"
                        iconPosition="left"
                      >
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
