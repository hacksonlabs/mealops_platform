import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import { Checkbox } from '../../../components/ui/custom/Checkbox';

const ExportModal = ({ isOpen, onClose, onExport, selectedOrders, totalOrders }) => {
  const [exportConfig, setExportConfig] = useState({
    format: 'csv',
    dateRange: 'selected',
    columns: ['date', 'restaurant', 'mealType', 'attendees', 'totalCost', 'status'],
    includeDetails: false,
    includeReceipts: false,
    customDateFrom: '',
    customDateTo: ''
  });

  if (!isOpen) return null;

  const formatOptions = [
    { value: 'csv', label: 'CSV (Comma Separated Values)' },
    { value: 'xlsx', label: 'Excel Spreadsheet' },
    { value: 'pdf', label: 'PDF Report' }
  ];

  const dateRangeOptions = [
    { value: 'selected', label: `Selected Orders (${selectedOrders?.length})` },
    { value: 'all', label: `All Orders (${totalOrders})` },
    { value: 'custom', label: 'Custom Date Range' }
  ];

  const columnOptions = [
    { value: 'date', label: 'Date & Time' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'mealType', label: 'Meal Type' },
    { value: 'location', label: 'Location' },
    { value: 'attendees', label: 'Attendees' },
    { value: 'totalCost', label: 'Total Cost' },
    { value: 'costPerPerson', label: 'Cost Per Person' },
    { value: 'status', label: 'Status' },
    { value: 'orderNumber', label: 'Order Number' },
    { value: 'paymentMethod', label: 'Payment Method' }
  ];

  const handleConfigChange = (key, value) => {
    setExportConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleColumnToggle = (column) => {
    const currentColumns = exportConfig?.columns;
    const updatedColumns = currentColumns?.includes(column)
      ? currentColumns?.filter(col => col !== column)
      : [...currentColumns, column];
    
    handleConfigChange('columns', updatedColumns);
  };

  const handleExport = () => {
    onExport(exportConfig);
    onClose();
  };

  const getExportPreview = () => {
    const orderCount = exportConfig?.dateRange === 'selected' 
      ? selectedOrders?.length 
      : exportConfig?.dateRange === 'all' 
        ? totalOrders 
        : 'Custom range';
    
    return {
      orders: orderCount,
      columns: exportConfig?.columns?.length,
      format: exportConfig?.format?.toUpperCase(),
      estimatedSize: exportConfig?.format === 'pdf' ? '2-5 MB' : '50-200 KB'
    };
  };

  const preview = getExportPreview();

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-card rounded-lg shadow-athletic-lg max-w-2xl w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center">
                <Icon name="Download" size={20} color="white" />
              </div>
              <div>
                <h2 className="text-xl font-heading font-semibold text-foreground">
                  Export Orders
                </h2>
                <p className="text-sm text-muted-foreground">
                  Configure your export settings
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              iconName="X"
            />
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Export Format */}
            <div>
              <Select
                label="Export Format"
                description="Choose the file format for your export"
                options={formatOptions}
                value={exportConfig?.format}
                onChange={(value) => handleConfigChange('format', value)}
              />
            </div>

            {/* Date Range */}
            <div>
              <Select
                label="Date Range"
                description="Select which orders to include"
                options={dateRangeOptions}
                value={exportConfig?.dateRange}
                onChange={(value) => handleConfigChange('dateRange', value)}
              />
              
              {exportConfig?.dateRange === 'custom' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <Input
                    type="date"
                    label="From Date"
                    value={exportConfig?.customDateFrom}
                    onChange={(e) => handleConfigChange('customDateFrom', e?.target?.value)}
                  />
                  <Input
                    type="date"
                    label="To Date"
                    value={exportConfig?.customDateTo}
                    onChange={(e) => handleConfigChange('customDateTo', e?.target?.value)}
                  />
                </div>
              )}
            </div>

            {/* Column Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Select Columns to Include
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
                {columnOptions?.map((column) => (
                  <Checkbox
                    key={column?.value}
                    label={column?.label}
                    checked={exportConfig?.columns?.includes(column?.value)}
                    onChange={() => handleColumnToggle(column?.value)}
                    size="sm"
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {exportConfig?.columns?.length} columns selected
              </p>
            </div>

            {/* Additional Options */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Additional Options
              </label>
              <Checkbox
                label="Include individual order details"
                description="Add team member orders and special instructions"
                checked={exportConfig?.includeDetails}
                onChange={(e) => handleConfigChange('includeDetails', e?.target?.checked)}
              />
              <Checkbox
                label="Include receipt links"
                description="Add downloadable receipt URLs to the export"
                checked={exportConfig?.includeReceipts}
                onChange={(e) => handleConfigChange('includeReceipts', e?.target?.checked)}
              />
            </div>

            {/* Export Preview */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-medium text-foreground mb-3">Export Preview</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Orders:</span>
                  <span className="ml-2 font-medium text-foreground">{preview?.orders}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Columns:</span>
                  <span className="ml-2 font-medium text-foreground">{preview?.columns}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Format:</span>
                  <span className="ml-2 font-medium text-foreground">{preview?.format}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Size:</span>
                  <span className="ml-2 font-medium text-foreground">{preview?.estimatedSize}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted">
            <div className="text-sm text-muted-foreground">
              Export will be downloaded to your device
            </div>
            <div className="flex items-center space-x-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={exportConfig?.columns?.length === 0}
                iconName="Download"
                iconPosition="left"
              >
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;