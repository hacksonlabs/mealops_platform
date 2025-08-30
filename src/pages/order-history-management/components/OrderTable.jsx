import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const OrderTable = ({ orders, selectedOrders, onOrderSelect, onSelectAll, onOrderAction, activeTab }) => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [loading, setLoading] = useState(false);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return 'ArrowUpDown';
    return sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';
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

  const getMealTypeIcon = (mealType) => {
    const icons = {
      breakfast: 'Coffee',
      lunch: 'Utensils',
      dinner: 'UtensilsCrossed',
      snack: 'Cookie'
    };
    return icons?.[mealType] || 'Utensils';
  };

  const getActionButtons = (order) => {
    if (activeTab === 'scheduled') {
      return (
        <div className="flex items-center space-x-1">
          {/* <Button
            variant="outline"
            size="sm"
            onClick={() => onOrderAction('modify', order)}
            iconName="Edit"
            iconPosition="left"
          >
            Modify
          </Button> */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderAction('view', order)}
            iconName="Eye"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderAction('cancel', order)}
            iconName="Trash2"
            title="Delete Group"
            className="text-red-600 hover:text-red-700"
          />
        </div>
      );
    } else if (activeTab === 'completed') {
      return (
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOrderAction('repeat', order)}
            iconName="RotateCcw"
            iconPosition="left"
          >
            Repeat
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOrderAction('copy', order)}
            iconName="Copy"
            iconPosition="left"
          >
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderAction('receipt', order)}
            iconName="Download"
          />
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOrderAction('repeat', order)}
            iconName="RotateCcw"
            iconPosition="left"
          >
            Repeat
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOrderAction('view', order)}
            iconName="Eye"
          />
        </div>
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

  const isAllSelected = orders?.length > 0 && selectedOrders?.length === orders?.length;
  const isIndeterminate = selectedOrders?.length > 0 && selectedOrders?.length < orders?.length;

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic overflow-hidden">
      {/* Table Header */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => onSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Date & Time</span>
                  <Icon name={getSortIcon('date')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('restaurant')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Restaurant</span>
                  <Icon name={getSortIcon('restaurant')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Meal Type</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('attendees')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Attendees</span>
                  <Icon name={getSortIcon('attendees')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('totalCost')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Total Cost</span>
                  <Icon name={getSortIcon('totalCost')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Status</span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders?.map((order) => (
              <tr key={order?.id} className="hover:bg-muted/50 transition-athletic">
                <td className="px-4 py-4">
                  <Checkbox
                    checked={selectedOrders?.includes(order?.id)}
                    onChange={(e) => onOrderSelect(order?.id, e?.target?.checked)}
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground font-medium">
                    {formatDate(order?.date)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order?.location}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                      <Icon name="Store" size={16} className="text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {order?.restaurant}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Order #{order?.orderNumber}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center space-x-2">
                    <Icon name={getMealTypeIcon(order?.mealType)} size={16} className="text-muted-foreground" />
                    <span className="text-sm text-foreground capitalize">
                      {order?.mealType}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm text-foreground font-medium">
                    {order?.attendees} people
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {order?.teamMembers?.slice(0, 2)?.join(', ')}
                    {order?.teamMembers?.length > 2 && ` +${order?.teamMembers?.length - 2} more`}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="text-sm font-medium text-foreground">
                    {formatCurrency(order?.totalCost)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(order?.totalCost / order?.attendees)} per person
                  </div>
                </td>
                <td className="px-4 py-4">
                  {getStatusBadge(order?.status)}
                </td>
                <td className="px-4 py-4 text-right">
                  {getActionButtons(order)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Empty State */}
      {orders?.length === 0 && (
        <div className="text-center py-12">
          <Icon name="ClipboardList" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground">
            Try adjusting your filters or create a new order to get started.
          </p>
        </div>
      )}
    </div>
  );
};

export default OrderTable;