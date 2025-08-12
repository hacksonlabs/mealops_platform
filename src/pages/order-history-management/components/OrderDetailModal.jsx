import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const OrderDetailModal = ({ order, isOpen, onClose, onAction }) => {
  if (!isOpen || !order) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })?.format(amount);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Scheduled' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
      modified: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Modified' }
    };

    const config = statusConfig?.[status] || statusConfig?.scheduled;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const memberOrders = [
    { name: 'Coach Johnson', order: 'Grilled Chicken Salad', specialInstructions: 'No croutons, extra dressing on side', cost: 12.99 },
    { name: 'Sarah Williams', order: 'Turkey Club Sandwich', specialInstructions: 'No mayo, add avocado', cost: 11.49 },
    { name: 'Mike Chen', order: 'Beef Burrito Bowl', specialInstructions: 'Extra rice, mild salsa', cost: 13.99 },
    { name: 'Alex Rodriguez', order: 'Chicken Caesar Wrap', specialInstructions: 'Light dressing', cost: 10.99 },
    { name: 'Emma Davis', order: 'Veggie Quinoa Bowl', specialInstructions: 'No cheese, extra vegetables', cost: 12.49 },
    { name: 'Jordan Smith', order: 'BBQ Pulled Pork Sandwich', specialInstructions: 'Extra BBQ sauce', cost: 13.49 }
  ];

  const modificationHistory = [
    { date: '2025-01-05 14:30', action: 'Order Created', user: 'Coach Johnson', details: 'Initial order placed for 6 people' },
    { date: '2025-01-06 09:15', action: 'Member Added', user: 'Sarah Williams', details: 'Added Jordan Smith to the order' },
    { date: '2025-01-06 11:45', action: 'Order Modified', user: 'Emma Davis', details: 'Changed Alex Rodriguez meal from Chicken Bowl to Caesar Wrap' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
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
                  Order #{order?.orderNumber} • {formatDate(order?.date)}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge(order?.status)}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                iconName="X"
              />
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto max-h-[calc(90vh-120px)]">
            <div className="p-6 space-y-6">
              {/* Order Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="Store" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Restaurant</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{order?.restaurant}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="MapPin" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Location</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{order?.location}</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="Users" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Attendees</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{order?.attendees} people</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Icon name="DollarSign" size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Total Cost</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground">{formatCurrency(order?.totalCost)}</p>
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
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Team Member</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Order</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Special Instructions</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {memberOrders?.map((memberOrder, index) => (
                          <tr key={index} className="hover:bg-card/50 transition-athletic">
                            <td className="px-4 py-3">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                                  <Icon name="User" size={14} color="white" />
                                </div>
                                <span className="text-sm font-medium text-foreground">
                                  {memberOrder?.name}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-foreground">
                              {memberOrder?.order}
                            </td>
                            <td className="px-4 py-3 text-sm text-muted-foreground">
                              {memberOrder?.specialInstructions || 'None'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                              {formatCurrency(memberOrder?.cost)}
                            </td>
                          </tr>
                        ))}
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
                      <div className="flex items-center space-x-2 mb-2">
                        <Icon name="CreditCard" size={16} className="text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Payment Method</span>
                      </div>
                      <p className="text-sm text-foreground">Team Credit Card (**** 4567)</p>
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
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

              {/* Modification History */}
              <div>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-4">
                  Modification History
                </h3>
                <div className="space-y-3">
                  {modificationHistory?.map((modification, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <Icon name="Clock" size={14} color="white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {modification?.action}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            by {modification?.user}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          {modification?.details}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(modification.date)?.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted">
            <div className="flex items-center space-x-2">
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
            <div className="flex items-center space-x-2">
              {order?.status === 'scheduled' && (
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