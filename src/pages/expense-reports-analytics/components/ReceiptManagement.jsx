import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';

const ReceiptManagement = ({ 
  onBulkDownload, 
  onCsvExport, 
  onConcurIntegration,
  onPdfBundle 
}) => {
  const [bundleType, setBundleType] = useState('monthly');
  const [bundleMonth, setBundleMonth] = useState('2025-01');
  const [bundleTrip, setBundleTrip] = useState('');

  const bundleOptions = [
    { value: 'monthly', label: 'Monthly Report' },
    { value: 'trip', label: 'Trip-based Report' },
    { value: 'custom', label: 'Custom Date Range' }
  ];

  const tripOptions = [
    { value: 'away-game-jan', label: 'Away Game - January 15' },
    { value: 'tournament-feb', label: 'Tournament - February 8-10' },
    { value: 'training-camp', label: 'Training Camp - March 1-5' }
  ];

  const handleGenerateBundle = () => {
    const bundleData = {
      type: bundleType,
      month: bundleMonth,
      trip: bundleTrip
    };
    onPdfBundle(bundleData);
  };

  return (
    <div className="space-y-6">
      {/* Bulk Actions */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-4">Receipt Management</h3>
        
        <div className="space-y-3">
          <Button
            variant="outline"
            fullWidth
            onClick={onBulkDownload}
            iconName="Download"
            iconPosition="left"
          >
            Bulk PDF Download
          </Button>
          
          <Button
            variant="outline"
            fullWidth
            onClick={onCsvExport}
            iconName="FileSpreadsheet"
            iconPosition="left"
          >
            Export to CSV
          </Button>
          
          <Button
            variant="outline"
            fullWidth
            onClick={onConcurIntegration}
            iconName="ExternalLink"
            iconPosition="left"
          >
            Send to Concur
          </Button>
        </div>
      </div>
      {/* PDF Bundle Generator */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-4">Generate Report Bundle</h3>
        
        <div className="space-y-4">
          <Select
            label="Report Type"
            options={bundleOptions}
            value={bundleType}
            onChange={setBundleType}
          />

          {bundleType === 'monthly' && (
            <Input
              label="Select Month"
              type="month"
              value={bundleMonth}
              onChange={(e) => setBundleMonth(e?.target?.value)}
            />
          )}

          {bundleType === 'trip' && (
            <Select
              label="Select Trip"
              options={tripOptions}
              value={bundleTrip}
              onChange={setBundleTrip}
              placeholder="Choose a trip..."
            />
          )}

          {bundleType === 'custom' && (
            <div className="space-y-3">
              <Input
                label="Start Date"
                type="date"
                value="2025-01-01"
              />
              <Input
                label="End Date"
                type="date"
                value="2025-01-31"
              />
            </div>
          )}

          <Button
            variant="default"
            fullWidth
            onClick={handleGenerateBundle}
            iconName="FileText"
            iconPosition="left"
          >
            Generate PDF Bundle
          </Button>
        </div>
      </div>
      {/* Payment Methods */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-4">Payment Methods</h3>
        
        <div className="space-y-3">
          {[
            { name: 'Team Card - Football', usage: '85%', isDefault: true },
            { name: 'Travel Card - Away Games', usage: '12%', isDefault: false },
            { name: 'Emergency Card', usage: '3%', isDefault: false }
          ]?.map((card, index) => (
            <div key={index} className="flex items-center justify-between p-3 border border-border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Icon name="CreditCard" size={20} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{card?.name}</p>
                  <p className="text-xs text-muted-foreground">Usage: {card?.usage}</p>
                </div>
              </div>
              {card?.isDefault && (
                <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
                  Default
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Quick Stats */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-4">Quick Stats</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Pending Receipts</span>
            <span className="text-sm font-medium text-foreground">3</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">This Month's Exports</span>
            <span className="text-sm font-medium text-foreground">12</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Last Concur Sync</span>
            <span className="text-sm font-medium text-foreground">2 hours ago</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptManagement;