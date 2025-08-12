import React, { useState } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';

const AddMemberModal = ({ onClose, onAdd }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'player',
    allergies: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (!formData?.name?.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }

    if (!formData?.email?.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(formData?.email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      const result = await onAdd(formData);
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to add member');
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
          <h3 className="text-lg font-semibold text-foreground">Add Team Member</h3>
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
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email Address *
              </label>
              <Input
                type="email"
                placeholder="Enter email address"
                value={formData?.email}
                onChange={(e) => handleInputChange('email', e?.target?.value)}
                required
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Member must already have an account to be added to the team
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Full Name *
              </label>
              <Input
                type="text"
                placeholder="Enter full name"
                value={formData?.full_name}
                onChange={(e) => handleInputChange('full_name', e?.target?.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Role *
              </label>
              <Select
                label="Role *"
                value={formData?.role}
                onChange={(value) => setFormData({ ...formData, role: value })}
                options={[
                  { value: 'player', label: 'Player' },
                  { value: 'coach', label: 'Coach' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'custom', label: 'Custom' },
                ]}
                required
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

            {/* Dietary Restrictions */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Dietary Restrictions / Allergies
              </label>
              <textarea
                placeholder="Enter any dietary restrictions or allergies"
                value={formData?.allergies}
                onChange={(e) => handleInputChange('allergies', e?.target?.value)}
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
              {loading ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberModal;