import React, { useState } from 'react';
import Button from '../../../../components/ui/custom/Button';
import Input from '../../../../components/ui/custom/Input';
import Select from '../../../../components/ui/custom/Select';
import Icon from '../../../../components/AppIcon';
import { Checkbox } from '../../../../components/ui/custom/Checkbox';

const AddLocationAddressModal = ({ onClose, onAdd, location }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    address_type: 'other',
    notes: '',
    is_primary: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const addressTypeOptions = [
    { value: 'school', label: 'School Building' },
    { value: 'hotel', label: 'Hotel Entrance' },
    { value: 'gym', label: 'Gym/Athletic Center' },
    { value: 'venue', label: 'Event Venue' },
    { value: 'other', label: 'Other' }
  ];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!formData?.name?.trim()) {
      setError('Address name is required');
      return;
    }

    if (!formData?.address?.trim()) {
      setError('Address is required');
      return;
    }

    setLoading(true);
    
    try {
      const addressData = {
        ...formData,
        location_id: location?.id
      };

      const result = await onAdd(addressData);
      
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to add address');
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Add Address</h3>
            <p className="text-sm text-muted-foreground">to {location?.name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
            disabled={loading}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Address Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Address Name *
              </label>
              <Input
                type="text"
                placeholder="e.g., Main Entrance, Athletic Wing, Student Center"
                value={formData?.name}
                onChange={(e) => handleInputChange('name', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Address Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Address Type
              </label>
              <Select
                value={formData?.address_type}
                onChange={(value) => handleInputChange('address_type', value)}
                options={addressTypeOptions}
                disabled={loading}
              />
            </div>

            {/* Full Address */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Address *
              </label>
              <Input
                type="text"
                placeholder="Enter complete address with building/wing details"
                value={formData?.address}
                onChange={(e) => handleInputChange('address', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Primary Address Checkbox */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_primary"
                checked={formData?.is_primary}
                onChange={(e) => setFormData({ ...formData, is_primary: e?.target?.checked })}
                disabled={loading}
              />
              <label htmlFor="is_primary" className="text-sm font-medium text-foreground">
                Set as primary address for this location
              </label>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Delivery Notes
              </label>
              <textarea
                placeholder="Special instructions, access codes, contact person, hours, etc."
                value={formData?.notes}
                onChange={(e) => handleInputChange('notes', e?.target?.value)}
                rows={3}
                disabled={loading}
                className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                <Icon name="AlertCircle" size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Info Message */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start space-x-2">
              <Icon name="Info" size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <p className="font-medium">Address Tips:</p>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Add specific building names, wings, or entrance details</li>
                  <li>• Include access codes or gate information if needed</li>
                  <li>• Note best delivery times or contact persons</li>
                  <li>• Specify if this entrance is used for different event types</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              iconName={loading ? "Loader2" : "Plus"}
              iconPosition="left"
              className={loading ? "animate-spin" : ""}
            >
              {loading ? 'Adding...' : 'Add Address'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLocationAddressModal;