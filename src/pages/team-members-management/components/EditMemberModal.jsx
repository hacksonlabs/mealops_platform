import React, { useState, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';

const EditMemberModal = ({ member, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: member?.user_profiles?.full_name || '',
    email: member?.user_profiles?.email || '',
    phone: member?.user_profiles?.phone || '',
    role: member?.user_profiles?.role || 'player',
    allergies: member?.user_profiles?.allergies || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (member?.user_profiles) {
      setFormData({
        full_name: member?.user_profiles?.full_name || '',
        role: member?.user_profiles?.role || 'player',
        phone: member?.user_profiles?.phone || '',
        allergies: member?.user_profiles?.allergies || '',
        is_active: member?.user_profiles?.is_active ?? true
      });
    }
  }, [member]);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!formData?.full_name) {
      setError('Full name is required');
      return;
    }

    setLoading(true);
    
    try {
      const result = await onUpdate(formData);
      
      if (result?.success) {
        onClose();
      } else {
        setError(result?.message || 'Failed to update member');
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
            <h3 className="text-lg font-semibold text-foreground">Edit Member</h3>
            <p className="text-sm text-muted-foreground">{member?.user_profiles?.email}</p>
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

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={formData?.is_active}
                onChange={(e) => handleInputChange('is_active', e?.target?.checked)}
                disabled={loading}
              />
              <label htmlFor="is_active" className="text-sm text-foreground">
                Active member (can participate in polls and orders)
              </label>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                <Icon name="AlertCircle" size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>

          {/* Member Stats */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="text-sm font-medium text-foreground mb-2">Member Statistics</h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground">Joined</p>
                <p className="text-foreground font-medium">
                  {new Date(member?.joined_at)?.toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="text-foreground font-medium">
                  {member?.user_profiles?.is_active ? 'Active' : 'Inactive'}
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
              {loading ? 'Updating...' : 'Update Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMemberModal;