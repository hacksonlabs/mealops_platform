import React, { useState } from 'react';

import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { Checkbox } from '../../../components/ui/Checkbox';

const OrderFilters = ({ filters, onFiltersChange, isCollapsed, onToggleCollapse, resultCount }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  const vendorOptions = [
    { value: '', label: 'All Vendors' },
    { value: 'chipotle', label: 'Chipotle Mexican Grill' },
    { value: 'subway', label: 'Subway' },
    { value: 'panera', label: 'Panera Bread' },
    { value: 'olive-garden', label: 'Olive Garden' },
    { value: 'pizza-hut', label: 'Pizza Hut' },
    { value: 'local-deli', label: 'Local Sports Deli' }
  ];

  const locationOptions = [
    { value: '', label: 'All Locations' },
    { value: 'home-stadium', label: 'Home Stadium' },
    { value: 'training-facility', label: 'Training Facility' },
    { value: 'away-venue', label: 'Away Venue' },
    { value: 'hotel', label: 'Team Hotel' },
    { value: 'conference-center', label: 'Conference Center' }
  ];

  const teamMembers = [
    { id: 1, name: 'Coach Johnson', role: 'Head Coach' },
    { id: 2, name: 'Sarah Williams', role: 'Assistant Coach' },
    { id: 3, name: 'Mike Chen', role: 'Player' },
    { id: 4, name: 'Alex Rodriguez', role: 'Player' },
    { id: 5, name: 'Emma Davis', role: 'Team Manager' },
    { id: 6, name: 'Jordan Smith', role: 'Player' },
    { id: 7, name: 'Taylor Brown', role: 'Athletic Trainer' },
    { id: 8, name: 'Casey Wilson', role: 'Player' }
  ];

  const handleFilterChange = (key, value) => {
    const updatedFilters = { ...localFilters, [key]: value };
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleClearFilters = () => {
    const clearedFilters = {
      dateFrom: '',
      dateTo: '',
      vendor: '',
      location: '',
      teamMembers: [],
      minCost: '',
      maxCost: '',
      search: ''
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(localFilters)?.some(value => 
    Array.isArray(value) ? value?.length > 0 : value !== ''
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic mb-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            iconName={isCollapsed ? "ChevronDown" : "ChevronUp"}
            iconPosition="left"
          >
            Advanced Filters
          </Button>
          {hasActiveFilters && (
            <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-muted-foreground">
            {resultCount} orders found
          </span>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              iconName="X"
              iconPosition="left"
            >
              Clear All
            </Button>
          )}
        </div>
      </div>
      {/* Filter Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <div className="w-full">
            <Input
              type="search"
              placeholder="Search orders, restaurants, or notes..."
              value={localFilters?.search || ''}
              onChange={(e) => handleFilterChange('search', e?.target?.value)}
              className="w-full"
            />
          </div>

          {/* Date Range and Vendor */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              type="date"
              label="From Date"
              value={localFilters?.dateFrom || ''}
              onChange={(e) => handleFilterChange('dateFrom', e?.target?.value)}
            />
            <Input
              type="date"
              label="To Date"
              value={localFilters?.dateTo || ''}
              onChange={(e) => handleFilterChange('dateTo', e?.target?.value)}
            />
            <Select
              label="Vendor"
              options={vendorOptions}
              value={localFilters?.vendor || ''}
              onChange={(value) => handleFilterChange('vendor', value)}
            />
            <Select
              label="Location"
              options={locationOptions}
              value={localFilters?.location || ''}
              onChange={(value) => handleFilterChange('location', value)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderFilters;