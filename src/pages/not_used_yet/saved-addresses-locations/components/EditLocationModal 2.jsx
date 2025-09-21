import React, { useState, useEffect } from 'react';
import Button from '../../../../components/ui/custom/Button';
import Input from '../../../../components/ui/custom/Input';
import Select from '../../../../components/ui/custom/Select';
import Icon from '../../../../components/AppIcon';

const EditLocationModal = ({ location, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    location_type: 'school',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const locationTypeOptions = [
    { value: 'school', label: 'School' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'gym', label: 'Gym' },
    { value: 'venue', label: 'Venue' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    if (location) {
      setFormData({
        name: location?.name || '',
        address: location?.address || '',
        location_type: location?.location_type || 'school',
        notes: location?.notes || ''
      });
    }
  }, [location]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!formData?.name?.trim()) {
      setError('Location name is required');
      return;
    }

    if (!formData?.address?.trim()) {
      setError('Address is required');
      return;
    }

    setLoading(true);
    
    try {
      const result = await onUpdate(formData);
      
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to update location');
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

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Edit Location</h3>
            <p className="text-sm text-muted-foreground">{location?.name}</p>
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
            {/* Location Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location Name *
              </label>
              <Input
                type="text"
                placeholder="Enter location name"
                value={formData?.name}
                onChange={(e) => handleInputChange('name', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Address *
              </label>
              <Input
                type="text"
                placeholder="Enter full address"
                value={formData?.address}
                onChange={(e) => handleInputChange('address', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Location Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location Type
              </label>
              <Select
                value={formData?.location_type}
                onChange={(value) => handleInputChange('location_type', value)}
                options={locationTypeOptions}
                disabled={loading}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Notes & Instructions
              </label>
              <textarea
                placeholder="Special delivery instructions, access codes, contact info..."
                value={formData?.notes}
                onChange={(e) => handleInputChange('notes', e?.target?.value)}
                rows={4}
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
          </div>

          {/* Location Stats */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Location Details</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="text-foreground font-medium">
                  {formatDate(location?.created_at)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Restaurants</p>
                <p className="text-foreground font-medium">
                  {location?.restaurants?.length || 0}
                </p>
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
              iconName={loading ? "Loader2" : "Save"}
              iconPosition="left"
              className={loading ? "animate-spin" : ""}
            >
              {loading ? 'Updating...' : 'Update Location'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLocationModal;