import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { getStatusBadge, getMealTypeIcon } from '../../../utils/ordersUtils';

const OrderDetailsModal = ({ 
  isOpen, 
  onClose, 
  order,
  onEdit,
  onCancel,
  onRepeat 
}) => {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!isOpen || !order) return null;

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (time) => {
    const [hours, minutes] = time?.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };


  const canEdit = order?.status === 'scheduled' && new Date(order.date) > new Date();
  const canCancel = order?.status !== 'cancelled' && order?.status !== 'completed';

  const handleCancel = () => {
    onCancel(order?.id);
    setShowCancelConfirm(false);
    onClose();
  };

  const handleRepeat = () => {
    onRepeat(order);
    onClose();
  };

  const handleEdit = () => {
    onEdit(order);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name={getMealTypeIcon(order?.mealType)} size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-semibold text-foreground">
                {order?.restaurant}
              </h2>
              <p className="text-sm text-muted-foreground">
                Order Details
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
            iconSize={20}
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            {getStatusBadge(order?.status)}
            <span className="text-sm text-muted-foreground">
              Order #{order?.id}
            </span>
          </div>

          {/* Order Information */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Icon name="Calendar" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Date</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {formatDate(order?.date)}
                </p>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Icon name="Clock" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Time</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {formatTime(order?.time)}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Icon name="Utensils" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Meal Type</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6 capitalize">
                {order?.mealType}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Icon name="Users" size={16} className="text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">Attendees</span>
              </div>
              <p className="text-sm text-muted-foreground pl-6">
                {order?.attendees} team members
              </p>
            </div>

            {order?.notes && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Icon name="FileText" size={16} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">Special Instructions</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6">
                  {order?.notes}
                </p>
              </div>
            )}
          </div>

          {/* Team Members */}
          {order?.members && order?.members?.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Team Members</h4>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {order?.members?.map(member => (
                  <div key={member?.id} className="flex items-center space-x-3 p-2 bg-muted/30 rounded-md">
                    <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                      <Icon name="User" size={14} color="white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {member?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member?.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Order Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Order Timeline</h4>
            <div className="space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="text-sm">
                  <span className="font-medium text-foreground">Order Created</span>
                  <span className="text-muted-foreground ml-2">
                    {new Date(order.createdAt)?.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
              
              {order?.status === 'confirmed' && (
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <div className="text-sm">
                    <span className="font-medium text-foreground">Order Confirmed</span>
                    <span className="text-muted-foreground ml-2">
                      {new Date()?.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRepeat}
              iconName="RotateCcw"
              iconSize={16}
            >
              Repeat Order
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Keep Order
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                >
                  Confirm Cancel
                </Button>
              </div>
            )}
            
            {canEdit && (
              <Button
                variant="default"
                size="sm"
                onClick={handleEdit}
                iconName="Edit"
                iconSize={16}
              >
                Edit Order
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsModal;