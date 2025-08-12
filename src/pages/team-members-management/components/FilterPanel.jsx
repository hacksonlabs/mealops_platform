import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import Icon from '../../../components/AppIcon';

const FilterPanel = ({ members, onFilterChange }) => {
  const [filters, setFilters] = useState({
    roles: [],
    dietaryRestrictions: [],
    joinedDateRange: 'all',
    hasPhone: false,
    hasAllergies: false
  });

  const roleOptions = [
    { value: 'player', label: 'Players', count: members?.filter(m => m?.user_profiles?.role === 'player')?.length || 0 },
    { value: 'coach', label: 'Coaches', count: members?.filter(m => m?.user_profiles?.role === 'coach')?.length || 0 },
    { value: 'admin', label: 'Admins', count: members?.filter(m => m?.user_profiles?.role === 'admin')?.length || 0 }
  ];

  const dateRangeOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'last-week', label: 'Last Week' },
    { value: 'last-month', label: 'Last Month' },
    { value: 'last-quarter', label: 'Last 3 Months' },
    { value: 'last-year', label: 'Last Year' }
  ];

  const handleRoleToggle = (role) => {
    const updatedRoles = filters?.roles?.includes(role)
      ? filters?.roles?.filter(r => r !== role)
      : [...filters?.roles, role];
    
    const updatedFilters = { ...filters, roles: updatedRoles };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleFilterToggle = (filterKey, value) => {
    const updatedFilters = { ...filters, [filterKey]: value };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const clearAllFilters = () => {
    const clearedFilters = {
      roles: [],
      dietaryRestrictions: [],
      joinedDateRange: 'all',
      hasPhone: false,
      hasAllergies: false
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const activeFilterCount = 
    filters?.roles?.length +
    filters?.dietaryRestrictions?.length +
    (filters?.joinedDateRange !== 'all' ? 1 : 0) +
    (filters?.hasPhone ? 1 : 0) +
    (filters?.hasAllergies ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground">Advanced Filters</h4>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            iconName="X"
            iconPosition="left"
          >
            Clear Filters ({activeFilterCount})
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Role Filters */}
        <div>
          <h5 className="font-medium text-foreground mb-3">Role</h5>
          <div className="space-y-2">
            {roleOptions?.map((role) => (
              <label key={role?.value} className="flex items-center space-x-2 cursor-pointer">
                <Checkbox
                  checked={filters?.roles?.includes(role?.value)}
                  onChange={() => handleRoleToggle(role?.value)}
                />
                <span className="text-sm text-foreground">{role?.label}</span>
                <span className="text-xs text-muted-foreground">({role?.count})</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range Filters */}
        <div>
          <h5 className="font-medium text-foreground mb-3">Join Date</h5>
          <div className="space-y-2">
            {dateRangeOptions?.map((option) => (
              <label key={option?.value} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="joinedDateRange"
                  value={option?.value}
                  checked={filters?.joinedDateRange === option?.value}
                  onChange={(e) => handleFilterToggle('joinedDateRange', e?.target?.value)}
                  className="w-4 h-4 text-primary border-border focus:ring-primary"
                />
                <span className="text-sm text-foreground">{option?.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Contact Info Filters */}
        <div>
          <h5 className="font-medium text-foreground mb-3">Contact Info</h5>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={filters?.hasPhone}
                onChange={(e) => handleFilterToggle('hasPhone', e?.target?.checked)}
              />
              <span className="text-sm text-foreground">Has Phone Number</span>
              <span className="text-xs text-muted-foreground">
                ({members?.filter(m => m?.user_profiles?.phone)?.length})
              </span>
            </label>
          </div>
        </div>

        {/* Health Info Filters */}
        <div>
          <h5 className="font-medium text-foreground mb-3">Health Info</h5>
          <div className="space-y-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <Checkbox
                checked={filters?.hasAllergies}
                onChange={(e) => handleFilterToggle('hasAllergies', e?.target?.checked)}
              />
              <span className="text-sm text-foreground">Has Dietary Restrictions</span>
              <span className="text-xs text-muted-foreground">
                ({members?.filter(m => m?.user_profiles?.allergies)?.length})
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center space-x-2 flex-wrap gap-2">
            <span className="text-sm font-medium text-foreground">Active filters:</span>
            
            {filters?.roles?.map(role => (
              <span key={role} className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                {role}
                <button 
                  onClick={() => handleRoleToggle(role)}
                  className="ml-1 hover:text-primary/70"
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            ))}

            {filters?.joinedDateRange !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                {dateRangeOptions?.find(opt => opt?.value === filters?.joinedDateRange)?.label}
                <button 
                  onClick={() => handleFilterToggle('joinedDateRange', 'all')}
                  className="ml-1 hover:text-primary/70"
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            )}

            {filters?.hasPhone && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                Has Phone
                <button 
                  onClick={() => handleFilterToggle('hasPhone', false)}
                  className="ml-1 hover:text-primary/70"
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            )}

            {filters?.hasAllergies && (
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                Has Allergies
                <button 
                  onClick={() => handleFilterToggle('hasAllergies', false)}
                  className="ml-1 hover:text-primary/70"
                >
                  <Icon name="X" size={12} />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;