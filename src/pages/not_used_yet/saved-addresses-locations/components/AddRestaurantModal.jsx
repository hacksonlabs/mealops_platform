import React, { useState } from 'react';
import Button from '../../../../components/ui/custom/Button';
import Input from '../../../../components/ui/custom/Input';
import Select from '../../../../components/ui/custom/Select';
import Icon from '../../../../components/AppIcon';
import { Checkbox } from '../../../../components/ui/custom/Checkbox';

const AddRestaurantModal = ({ onClose, onAdd, locations, preSelectedLocation }) => {
  const [formData, setFormData] = useState({
    name: '',
    cuisine_type: '',
    phone: '',
    notes: '',
    location_id: preSelectedLocation?.id || '',
    is_favorite: false,
    supports_catering: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const cuisineOptions = [
    { value: 'american', label: 'American' },
    { value: 'italian', label: 'Italian' },
    { value: 'chinese', label: 'Chinese' },
    { value: 'mexican', label: 'Mexican' },
    { value: 'indian', label: 'Indian' },
    { value: 'japanese', label: 'Japanese' },
    { value: 'mediterranean', label: 'Mediterranean' },
    { value: 'thai', label: 'Thai' },
    { value: 'other', label: 'Other' }
  ];

  const locationOptions = locations?.map(location => ({
    value: location?.id,
    label: location?.name
  })) || [];

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData?.name?.trim()) {
      setError('Restaurant name is required');
      setLoading(false);
      return;
    }

    if (!formData?.location_id) {
      setError('Please select a location');
      setLoading(false);
      return;
    }

    try {
      const result = await onAdd(formData);
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to add restaurant');
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
          <h3 className="text-lg font-semibold text-foreground">Add Restaurant</h3>
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
            {/* Restaurant Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Restaurant Name *
              </label>
              <Input
                type="text"
                placeholder="Enter restaurant name"
                value={formData?.name}
                onChange={(e) => handleInputChange('name', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location *
              </label>
              <Select
                value={formData?.location_id}
                onChange={(value) => handleInputChange('location_id', value)}
                options={locationOptions}
                disabled={loading}
              />
              {locationOptions?.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No locations available. Please add a location first.
                </p>
              )}
            </div>

            {/* Cuisine Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Cuisine Type
              </label>
              <Select
                value={formData?.cuisine_type}
                onChange={(value) => handleInputChange('cuisine_type', value)}
                options={cuisineOptions}
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="Enter phone number"
                value={formData?.phone}
                onChange={(e) => handleInputChange('phone', e?.target?.value)}
                disabled={loading}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_favorite"
                  checked={formData?.is_favorite}
                  onChange={(e) => setFormData({ ...formData, is_favorite: e?.target?.checked })}
                />
                <label htmlFor="is_favorite" className="text-sm font-medium text-foreground">
                  Mark as favorite
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="supports_catering"
                  checked={formData?.supports_catering}
                  onChange={(e) => setFormData({ ...formData, supports_catering: e?.target?.checked })}
                />
                <label htmlFor="supports_catering" className="text-sm font-medium text-foreground">
                  Catering available
                </label>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes
              </label>
              <textarea
                placeholder="Special notes about this restaurant (hours, preferred contact, etc.)"
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
              <Icon name="Info" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Restaurant Tips:</p>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Contact the restaurant to establish ordering procedures</li>
                  <li>• Ask about group discounts and catering options</li>
                  <li>• Note their preferred contact method and hours</li>
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
              disabled={loading || locationOptions?.length === 0}
              iconName={loading ? "Loader2" : "Plus"}
              iconPosition="left"
              className={loading ? "animate-spin" : ""}
            >
              {loading ? 'Adding...' : 'Add Restaurant'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddRestaurantModal;