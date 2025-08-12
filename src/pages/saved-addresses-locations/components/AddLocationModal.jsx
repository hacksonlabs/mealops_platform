import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const AddLocationModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    location_type: 'school',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const locationTypeOptions = [
    { value: 'school', label: 'School' },
    { value: 'hotel', label: 'Hotel' },
    { value: 'gym', label: 'Gym' },
    { value: 'venue', label: 'Venue' },
    { value: 'other', label: 'Other' }
  ];

  // Suggested location names based on type
  const getLocationSuggestions = (type) => {
    const suggestions = {
      school: [
        'University Campus',
        'High School Main',
        'Community College',
        'Training Academy',
        'Athletic Institute'
      ],
      hotel: [
        'Team Hotel Downtown',
        'Conference Hotel',
        'Away Game Lodge',
        'Tournament Inn',
        'Travel Accommodation'
      ],
      gym: [
        'Athletic Center',
        'Fitness Complex',
        'Training Facility',
        'Sports Center',
        'Workout Venue'
      ],
      venue: [
        'Event Center',
        'Conference Hall',
        'Meeting Venue',
        'Banquet Hall',
        'Activity Center'
      ],
      other: [
        'Custom Location',
        'Special Venue',
        'Unique Spot',
        'Team Gathering Place',
        'Practice Location'
      ]
    };
    return suggestions?.[type] || [];
  };

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
      const result = await onAdd(formData);
      
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to add location');
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

  const handleSuggestionClick = (suggestion) => {
    setFormData(prev => ({ ...prev, name: suggestion }));
    setShowSuggestions(false);
  };

  const suggestions = getLocationSuggestions(formData?.location_type);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">Add New Location</h3>
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
            {/* Location Type */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location Type
              </label>
              <Select
                value={formData?.location_type}
                onChange={(value) => {
                  handleInputChange('location_type', value);
                  setShowSuggestions(false);
                }}
                options={locationTypeOptions}
                disabled={loading}
              />
            </div>

            {/* Location Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Location Name *
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Enter location name"
                  value={formData?.name}
                  onChange={(e) => handleInputChange('name', e?.target?.value)}
                  onFocus={() => setShowSuggestions(true)}
                  required
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  iconName="ChevronDown"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  disabled={loading}
                />
              </div>

              {/* Suggestions Dropdown */}
              {showSuggestions && suggestions?.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-athletic-lg max-h-48 overflow-y-auto">
                  <div className="p-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2 px-2">
                      Suggested {formData?.location_type} names:
                    </div>
                    {suggestions?.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted rounded-md transition-colors"
                        disabled={loading}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Primary Address *
              </label>
              <Input
                type="text"
                placeholder="Enter full address"
                value={formData?.address}
                onChange={(e) => handleInputChange('address', e?.target?.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                You can add additional addresses after creating the location
              </p>
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
              <p className="text-xs text-muted-foreground mt-1">
                Include any special instructions for delivery drivers
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                <Icon name="AlertCircle" size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Enhanced Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
              <Icon name="Info" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Location Setup Tips:</p>
                <ul className="mt-1 text-xs space-y-1">
                  <li>• Use descriptive names that your team will recognize</li>
                  <li>• Add multiple addresses after creation for different venue types</li>
                  <li>• Save restaurants specifically to this location</li>
                  <li>• Include complete street address with zip code</li>
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
              {loading ? 'Adding...' : 'Add Location'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddLocationModal;