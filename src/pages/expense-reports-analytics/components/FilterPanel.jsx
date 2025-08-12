import React from 'react';
import Select from '../../../components/ui/Select';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';

const FilterPanel = ({ 
  filters, 
  onFilterChange, 
  onApplyFilters, 
  onResetFilters 
}) => {
  const vendorOptions = [
    { value: 'all', label: 'All Vendors' },
    { value: 'pizza-palace', label: 'Pizza Palace' },
    { value: 'healthy-bites', label: 'Healthy Bites' },
    { value: 'burger-barn', label: 'Burger Barn' },
    { value: 'taco-time', label: 'Taco Time' },
    { value: 'sandwich-spot', label: 'Sandwich Spot' }
  ];

  const teamOptions = [
    { value: 'all', label: 'All Teams' },
    { value: 'varsity-football', label: 'Varsity Football' },
    { value: 'jv-football', label: 'JV Football' },
    { value: 'basketball', label: 'Basketball' },
    { value: 'soccer', label: 'Soccer' },
    { value: 'track', label: 'Track & Field' }
  ];

  const locationOptions = [
    { value: 'all', label: 'All Locations' },
    { value: 'home-stadium', label: 'Home Stadium' },
    { value: 'away-games', label: 'Away Games' },
    { value: 'training-facility', label: 'Training Facility' },
    { value: 'team-hotel', label: 'Team Hotel' }
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Filters</h3>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onResetFilters}
            iconName="RotateCcw"
            iconPosition="left"
          >
            Reset
          </Button>
          <Button 
            variant="default" 
            size="sm" 
            onClick={onApplyFilters}
            iconName="Filter"
            iconPosition="left"
          >
            Apply Filters
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="lg:col-span-2">
          <Input
            label="Date Range"
            type="date"
            value={filters?.startDate}
            onChange={(e) => onFilterChange('startDate', e?.target?.value)}
            className="mb-2"
          />
          <Input
            type="date"
            value={filters?.endDate}
            onChange={(e) => onFilterChange('endDate', e?.target?.value)}
          />
        </div>

        <Select
          label="Vendor"
          options={vendorOptions}
          value={filters?.vendor}
          onChange={(value) => onFilterChange('vendor', value)}
          searchable
        />

        <Select
          label="Team"
          options={teamOptions}
          value={filters?.team}
          onChange={(value) => onFilterChange('team', value)}
        />

        <Select
          label="Location"
          options={locationOptions}
          value={filters?.location}
          onChange={(value) => onFilterChange('location', value)}
        />

        <Input
          label="Budget Threshold"
          type="number"
          placeholder="$0.00"
          value={filters?.budgetThreshold}
          onChange={(e) => onFilterChange('budgetThreshold', e?.target?.value)}
        />
      </div>
    </div>
  );
};

export default FilterPanel;