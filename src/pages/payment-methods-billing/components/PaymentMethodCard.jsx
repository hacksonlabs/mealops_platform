import React, { useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';

const PaymentMethodCard = ({ 
  method, 
  onEdit, 
  onDelete, 
  onSetDefault, 
  onViewTransactions, 
  onAssignTeam 
}) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleMenuAction = (action) => {
    setShowMenu(false);
    switch (action) {
      case 'edit':
        onEdit?.(method);
        break;
      case 'delete':
        onDelete?.(method?.id);
        break;
      case 'setDefault':
        onSetDefault?.(method?.id, method?.team_id);
        break;
      case 'viewTransactions':
        onViewTransactions?.(method);
        break;
      case 'assignTeam':
        onAssignTeam?.(method);
        break;
    }
  };

  const getCardTypeIcon = (lastFour) => {
    // Simple card type detection based on last four digits pattern
    const firstDigit = lastFour?.charAt(0);
    switch (firstDigit) {
      case '4':
        return 'CreditCard'; // Visa
      case '5':
        return 'CreditCard'; // Mastercard
      case '3':
        return 'CreditCard'; // Amex
      default:
        return 'CreditCard';
    }
  };

  const getCardTypeName = (lastFour) => {
    const firstDigit = lastFour?.charAt(0);
    switch (firstDigit) {
      case '4': return 'Visa';
      case '5': return 'Mastercard';
      case '3': return 'American Express';
      default: return 'Card';
    }
  };

  const getCardTypeColor = (lastFour) => {
    const firstDigit = lastFour?.charAt(0);
    switch (firstDigit) {
      case '4': return 'from-blue-500 to-blue-700';
      case '5': return 'from-red-500 to-red-700';
      case '3': return 'from-green-500 to-green-700';
      default: return 'from-gray-500 to-gray-700';
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:shadow-md transition-shadow relative overflow-hidden">
      {/* Security Indicator */}
      <div className="absolute top-4 right-4">
        <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
          <Icon name="Shield" size={10} />
          <span>Secure</span>
        </div>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`w-12 h-8 bg-gradient-to-r ${getCardTypeColor(method?.last_four)} rounded-lg flex items-center justify-center shadow-sm`}>
            <Icon name={getCardTypeIcon(method?.last_four)} size={20} color="white" />
          </div>
          <div>
            <h3 className="font-medium text-foreground">{method?.card_name}</h3>
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">•••• {method?.last_four}</p>
              <span className="text-xs text-blue-600">{getCardTypeName(method?.last_four)}</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 hover:bg-muted rounded-md transition-colors"
          >
            <Icon name="MoreVertical" size={16} className="text-muted-foreground" />
          </button>
          
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-20">
                <div className="py-1">
                  <button
                    onClick={() => handleMenuAction('edit')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center space-x-2"
                  >
                    <Icon name="Edit2" size={14} />
                    <span>Edit Details</span>
                  </button>
                  
                  {!method?.is_default && (
                    <button
                      onClick={() => handleMenuAction('setDefault')}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center space-x-2"
                    >
                      <Icon name="Star" size={14} />
                      <span>Set as Default</span>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleMenuAction('viewTransactions')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center space-x-2"
                  >
                    <Icon name="Receipt" size={14} />
                    <span>View Transactions</span>
                  </button>
                  
                  <button
                    onClick={() => handleMenuAction('assignTeam')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center space-x-2"
                  >
                    <Icon name="Users" size={14} />
                    <span>Reassign Team</span>
                  </button>
                  
                  <div className="border-t border-border my-1" />
                  
                  <button
                    onClick={() => handleMenuAction('delete')}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-destructive flex items-center space-x-2"
                  >
                    <Icon name="Trash2" size={14} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {/* Team Assignment */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Assigned Team</span>
          <span className="text-sm font-medium text-foreground">
            {method?.team?.name || 'Unassigned'}
          </span>
        </div>

        {/* Default Badge */}
        {method?.is_default && (
          <div className="flex items-center space-x-2">
            <Icon name="Star" size={14} className="text-yellow-500" />
            <span className="text-sm font-medium text-yellow-700">Default Payment Method</span>
          </div>
        )}

        {/* Enhanced Security Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Security Status</span>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700 font-medium">PCI Verified</span>
          </div>
        </div>

        {/* Encryption Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Encryption</span>
          <div className="flex items-center space-x-2">
            <Icon name="Lock" size={14} className="text-blue-500" />
            <span className="text-sm text-blue-700">256-bit SSL</span>
          </div>
        </div>

        {/* Demo Data Indicator */}
        <div className="p-2 bg-blue-50 border border-blue-200 rounded text-center">
          <div className="flex items-center justify-center space-x-1">
            <Icon name="Info" size={12} className="text-blue-600" />
            <span className="text-xs text-blue-800 font-medium">Demo Payment Method</span>
          </div>
          <p className="text-xs text-blue-700 mt-1">
            This is secure demonstration data only
          </p>
        </div>

        {/* Created By */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Added By</span>
          <span className="text-sm text-foreground">
            {method?.created_by_profile?.full_name || 'System Admin'}
          </span>
        </div>

        {/* Created Date */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Added</span>
          <span className="text-sm text-foreground">
            {method?.created_at ? new Date(method.created_at)?.toLocaleDateString() : 'Today'}
          </span>
        </div>
      </div>
      {/* Enhanced Quick Actions */}
      <div className="mt-6 flex space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onViewTransactions?.(method)}
          className="flex-1 text-xs"
          disabled
        >
          <Icon name="Receipt" size={14} className="mr-1" />
          Demo Transactions
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit?.(method)}
          className="flex-1 text-xs"
          disabled
        >
          <Icon name="Edit2" size={14} className="mr-1" />
          Demo Edit
        </Button>
      </div>

      {/* Legal Compliance Note */}
      <div className="mt-3 text-center">
        <p className="text-xs text-muted-foreground">
          Payment data encrypted & PCI compliant
        </p>
      </div>
    </div>
  );
};

export default PaymentMethodCard;