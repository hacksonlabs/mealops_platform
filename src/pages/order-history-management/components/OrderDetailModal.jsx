// /src/pages/order-history-management/components/OrderDetailModal.jsx
import React from 'react';
import Icon from '../../../components/AppIcon';
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

const OrderDetailModal = ({ order, isOpen, onClose, onAction }) => {
  if (!isOpen || !order) return null;

  // Prefer normalized snapshot items. Support a few shapes defensively.
  const items = React.useMemo(
    () => order?.items || order?.meal_order_items || order?.meal_items || [],
    [order]
  );

  // Helpers to resolve assignee (for display + unique counting)
  const getAssigneeName = (it) =>
    it?.team_member?.full_name || // joined alias (team_members)
    it?.member?.name ||           // fallback from other shapes
    (it?.user_profile
      ? `${it.user_profile.first_name || ''} ${it.user_profile.last_name || ''}`.trim()
      : null);

  const getAssigneeKey = (it) =>
    it?.team_member_id ||
    it?.user_id ||
    it?.team_member?.id ||
    it?.user_profile?.id ||
    getAssigneeName(it) || null;

  const { assignedPeople, peopleCount } = React.useMemo(() => {
    const setKeys = new Set();
    const seen = new Map(); // key -> display name
    (items || []).forEach((it) => {
      const key = getAssigneeKey(it);
      const name = getAssigneeName(it);
      if (key) setKeys.add(String(key));
      if (key && name && !seen.has(String(key))) seen.set(String(key), name);
    });
    const names = Array.from(seen.values());
    return { assignedPeople: names, peopleCount: setKeys.size };
  }, [items]);

  const mealType = order?.meal_type || 'other';
  const fulfillment = (order?.fulfillment_method || '').toLowerCase();
  const isDelivery = fulfillment === 'delivery';

  const restaurantName = order?.restaurant?.name || '—';
  const restaurantAddr = order?.restaurant?.address || '';

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
        <div className="relative bg-card rounded-lg shadow-athletic-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <Icon name="ClipboardList" size={24} color="white" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-semibold text-foreground">
                  Order Details
                </h2>
                <p className="text-sm text-muted-foreground">
                  Order #{order?.api_order_id || `ORD-${String(order?.id || '').substring(0, 8)}`} •{' '}
                  {formatDate(order?.scheduled_date)}
                </p>
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

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="p-6 space-y-6">
              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Store" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Restaurant</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{restaurantName}</p>
                  {restaurantAddr && (
                    <p className="text-xs text-muted-foreground mt-1">{restaurantAddr}</p>
                  )}
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {isDelivery ? 'Deliver to' : 'Pickup from'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {locationStr || '—'}
                  </p>
                  {!!order?.delivery_instructions && isDelivery && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {order.delivery_instructions}
                    </p>
                  )}
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Users" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Attendees</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{peopleCount}</p>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Total Cost</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(order?.total_amount)}
                  </p>
                </div>
              </div>

              {/* Line Items (with assigned member) */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Line Items
                </h3>
                <div className="bg-muted rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-card">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Assigned To
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Item
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Notes
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-foreground">
                            Qty
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-foreground">
                            Unit
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-foreground">
                            Line Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(items ?? []).map((it) => {
                          const unit = getUnitPrice(it);
                          const qty = it?.quantity ?? 1;
                          const line = unit * qty;
                          const assignee = getAssigneeName(it);
                          return (
                            <tr key={it.id} className="hover:bg-card/50 transition-athletic">
                              <td className="px-4 py-3 text-sm text-foreground">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                                    <Icon name="User" size={14} color="white" />
                                  </div>
                                  <span>{assignee || 'Unassigned'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm text-foreground">{it?.name}</td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">
                                {it?.notes || '—'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                                {qty}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                                {formatCurrency(unit)}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                                {formatCurrency(line)}
                              </td>
                            </tr>
                          );
                        })}
                        {(!items || items.length === 0) && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-4 py-6 text-sm text-muted-foreground text-center"
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
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Payment Information
                </h3>
                <div className="bg-muted rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="CreditCard" size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          Payment Method
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {paymentMethod?.card_name && paymentMethod?.last_four
                          ? `${paymentMethod.card_name} (**** ${paymentMethod.last_four})`
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="Receipt" size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Receipt</span>
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

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onAction('repeat', order)}
                iconName="RotateCcw"
                iconPosition="left"
              >
                Repeat Order
              </Button>
              <Button
                variant="outline"
                onClick={() => onAction('copy', order)}
                iconName="Copy"
                iconPosition="left"
              >
                Copy Order
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {order?.order_status === 'scheduled' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => onAction('modify', order)}
                    iconName="Edit"
                    iconPosition="left"
                  >
                    Modify Order
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => onAction('cancel', order)}
                    iconName="X"
                    iconPosition="left"
                  >
                    Cancel Order
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailModal;
