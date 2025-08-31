import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import {
  getStatusBadge,
  formatDate,
  formatCurrency,
  getMealTypeIcon,
} from '../../../utils/ordersUtils';

const OrderDetailModal = ({ order, isOpen, onClose, onAction }) => {
  if (!isOpen || !order) return null;

  // Unique attendees by team_member_id or user_id
  const uniqueAttendees = React.useMemo(() => {
    const m = new Map();
    (order?.order_items || []).forEach((it) => {
      const key = it.team_member_id || it.user_id || it.id;
      if (!m.has(key)) {
        const name =
          it?.team_members?.full_name ??
          (it?.user_profiles
            ? `${it.user_profiles.first_name} ${it.user_profiles.last_name}`
            : 'Team Member');
        m.set(key, name);
      }
    });
    return Array.from(m.values());
  }, [order]);

  const pplCount = uniqueAttendees.length || 0;

  // Prefer DB enum; fallback to 'other'
  const mealType = order?.meal_type || 'other';

  // Addresses from the joined tables (these are included in your select())
  const restaurantName = order?.restaurants?.name || '—';
  const restaurantAddr = order?.restaurants?.address || '';
  const locationName = order?.saved_locations?.name || '—';
  const locationAddr = order?.saved_locations?.address || '';

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
              {/* meal type icon next to status */}
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
              {/* Order Summary (no Meal Type card now) */}
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
                    <span className="text-sm font-medium text-foreground">Location</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{locationName}</p>
                  {locationAddr && (
                    <p className="text-xs text-muted-foreground mt-1">{locationAddr}</p>
                  )}
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="Users" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Attendees</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{pplCount} people</p>
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

              {/* Individual Orders */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Individual Orders
                </h3>
                <div className="bg-muted rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-card">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Team Member
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Order
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">
                            Special Instructions
                          </th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-foreground">
                            Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(order?.order_items ?? []).map((it) => (
                          <tr key={it.id} className="hover:bg-card/50 transition-athletic">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                                  <Icon name="User" size={14} color="white" />
                                </div>
                                <span className="text-sm font-medium text-foreground">
                                  {it?.team_members?.full_name ??
                                    (it?.user_profiles
                                      ? `${it.user_profiles.first_name} ${it.user_profiles.last_name}`
                                      : 'Team Member')}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {it.item_name}
                              {it.quantity > 1 ? ` × ${it.quantity}` : ''}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {it.special_instructions || 'None'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                              {formatCurrency(it.price)}
                            </td>
                          </tr>
                        ))}
                        {(!order?.order_items || order.order_items.length === 0) && (
                          <tr>
                            <td
                              colSpan={4}
                              className="px-4 py-6 text-sm text-muted-foreground text-center"
                            >
                              No individual items recorded for this order.
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
                        {order?.payment_methods
                          ? `${order.payment_methods.card_name} (**** ${order.payment_methods.last_four})`
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