import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const BulkActions = ({ selectedOrders, orders, onBulkAction, onClearSelection }) => {
  const [selectedAction, setSelectedAction] = useState('');

  const actionOptions = [
    { value: '', label: 'Select bulk action...' },
    { value: 'download-receipts', label: 'Download All Receipts' },
    { value: 'export-csv', label: 'Export to CSV' },
    { value: 'generate-report', label: 'Generate Expense Report' },
    { value: 'send-summary', label: 'Email Summary' },
    { value: 'cancel-orders', label: 'Cancel Selected Orders' }
  ];

  const handleExecuteAction = () => {
    if (selectedAction && selectedOrders?.length > 0) {
      onBulkAction(selectedAction, selectedOrders);
      setSelectedAction('');
    }
  };

  const getSelectedOrdersData = () => {
    return orders?.filter(order => selectedOrders?.includes(order?.id));
  };

  const calculateTotalCost = () => {
    const selectedOrdersData = getSelectedOrdersData();
    return selectedOrdersData?.reduce((total, order) => total + order?.totalCost, 0);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    })?.format(amount);
  };

  if (selectedOrders?.length === 0) {
    return null;
  }

  return (
    <div className="bg-primary text-primary-foreground rounded-lg p-4 mb-6 shadow-athletic">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Icon name="CheckSquare" size={20} />
            <span className="font-medium">
              {selectedOrders?.length} order{selectedOrders?.length !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-4 text-sm opacity-90">
            <span>Total: {formatCurrency(calculateTotalCost())}</span>
            <span>•</span>
            <span>
              {getSelectedOrdersData()?.reduce((total, order) => total + order?.attendees, 0)} people
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Select
              options={actionOptions}
              value={selectedAction}
              onChange={setSelectedAction}
              className="min-w-48"
            />
            <Button
              variant="secondary"
              onClick={handleExecuteAction}
              disabled={!selectedAction}
              iconName="Play"
              iconPosition="left"
            >
              Execute
            </Button>
          </div>

          <div className="h-6 w-px bg-primary-foreground/20" />

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            iconName="X"
            className="text-primary-foreground hover:bg-primary-foreground/10"
          >
            Clear
          </Button>
        </div>
      </div>
      {/* Quick Actions */}
      <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-primary-foreground/20">
        <span className="text-sm opacity-90">Quick actions:</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBulkAction('download-receipts', selectedOrders)}
          iconName="Download"
          iconPosition="left"
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          Download Receipts
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBulkAction('export-csv', selectedOrders)}
          iconName="FileText"
          iconPosition="left"
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          Export CSV
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onBulkAction('generate-report', selectedOrders)}
          iconName="BarChart3"
          iconPosition="left"
          className="text-primary-foreground hover:bg-primary-foreground/10"
        >
          Generate Report
        </Button>
      </div>
    </div>
  );
};

export default BulkActions;