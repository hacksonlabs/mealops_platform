import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

const DEFAULT_VENDOR_OPTIONS = [{ value: '', label: 'All Restaurants' }];

const OrderFilters = ({ filters, onFiltersChange, isCollapsed, onToggleCollapse, resultCount }) => {
  const { activeTeam } = useAuth();
  const teamId = activeTeam?.id ?? null;

  const [localFilters, setLocalFilters] = useState(filters);
  const [vendorOptions, setVendorOptions] = useState(DEFAULT_VENDOR_OPTIONS);
  const [loadingLookups, setLoadingLookups] = useState(false);

  // Keep local state in sync with parent if parent updates
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  useEffect(() => {
    const loadVendors = async () => {
      if (!teamId) {
        setVendorOptions(DEFAULT_VENDOR_OPTIONS);
        return;
      }
      setLoadingLookups(true);
      try {
        // Get the set of restaurant_ids used by this team
        const { data: orderIds, error: orderErr } = await supabase
          .from('meal_orders')
          .select('restaurant_id')
          .eq('team_id', teamId)
          .not('restaurant_id', 'is', null); // only orders that reference a restaurant

        if (orderErr) throw orderErr;

        const ids = Array.from(
          new Set((orderIds ?? []).map((r) => r.restaurant_id).filter(Boolean))
        );

        if (ids.length === 0) {
          setVendorOptions(DEFAULT_VENDOR_OPTIONS);
          return;
        }

        // Look up those restaurants' names
        const { data: rests, error: restErr } = await supabase
          .from('restaurants')
          .select('id, name')
          .in('id', ids)
          .order('name', { ascending: true });

        if (restErr) throw restErr;

        // De-dupe by normalized name
        const byName = new Map();
        (rests ?? []).forEach((r) => {
          const norm = (r?.name || '').trim().toLowerCase();
          if (norm && !byName.has(norm)) byName.set(norm, r.name.trim());
        });

        const vendOpts = [
          ...DEFAULT_VENDOR_OPTIONS,
          ...Array.from(byName.values()).map((name) => ({ value: name, label: name })),
        ];

        setVendorOptions(vendOpts);
      } catch (e) {
        console.error('Failed to load vendor lookups:', e?.message || e);
        setVendorOptions(DEFAULT_VENDOR_OPTIONS);
      } finally {
        setLoadingLookups(false);
      }
    };

    loadVendors();
  }, [teamId]);

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
      teamMembers: [],
      minCost: '',
      maxCost: '',
      search: ''
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
  };

  const hasActiveFilters = Object.values(localFilters)?.some((value) =>
    Array.isArray(value) ? value?.length > 0 : value !== ''
  );

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic mb-6">
      {/* Filter Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            iconName={isCollapsed ? 'ChevronDown' : 'ChevronUp'}
            iconPosition="left"
            className="w-full sm:w-auto"
          >
            Advanced Filters
          </Button>
          {hasActiveFilters && (
            <span className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded-full self-start sm:self-auto">
              Active
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 gap-2">
          <span className="text-sm text-muted-foreground text-center sm:text-left">
            {resultCount} orders found
          </span>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              iconName="X"
              iconPosition="left"
              className="w-full sm:w-auto"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="self-end">
              <Input
                type="date"
                label="From Date"
                value={localFilters?.dateFrom || ''}
                onChange={(e) => handleFilterChange('dateFrom', e?.target?.value)}
                className="w-full"
              />
            </div>

            <div className="self-end">
              <Input
                type="date"
                label="To Date"
                value={localFilters?.dateTo || ''}
                onChange={(e) => handleFilterChange('dateTo', e?.target?.value)}
                className="w-full"
              />
            </div>

            <div className="self-end">
              <Select
                label="Restaurant"
                searchable
                options={vendorOptions}
                value={localFilters?.vendor || ''}
                onChange={(value) => handleFilterChange('vendor', value)}
                disabled={loadingLookups}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderFilters;
