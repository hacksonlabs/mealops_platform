import React, { useState, useEffect, useMemo } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/custom/Checkbox';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday } from '../../../utils/stringUtils';

const EditMemberModal = ({ member, onClose, onUpdate }) => {
  // Use team_members fields only
  const src = useMemo(
    () => ({
      id: member?.id ?? null,
      full_name: member?.full_name ?? '',
      email: member?.email ?? '',
      phone_number: member?.phone_number ?? '',
      role: (member?.role ?? 'player')?.toLowerCase(),
      allergies: member?.allergies ?? '',
      birthday: member?.birthday ?? '',
      is_active: typeof member?.is_active === 'boolean' ? member.is_active : true,
      joined_at: member?.joined_at ?? member?.created_at ?? null,
    }),
    [member]
  );

  const [formData, setFormData] = useState({
    full_name: toTitleCase(src.full_name),
    email: src.email.toLowerCase(),
    phone_number: normalizePhoneNumber(src.phone_number),
    role: src.role.toLowerCase(),
    allergies: toTitleCase(src.allergies),
    birthday: normalizeBirthday(src.birthday),
    is_active: src.is_active,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync when member changes
  useEffect(() => {
    setFormData({
      full_name: toTitleCase(src.full_name),
      email: src.email.toLowerCase(),
      phone_number: normalizePhoneNumber(src.phone_number),
      role: src.role.toLowerCase(),
      allergies: toTitleCase(src.allergies),
      birthday: normalizeBirthday(src.birthday),
      is_active: src.is_active,
    });
  }, [src]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!formData.full_name?.trim()) {
      setError('Full name is required');
      return;
    }

    setLoading(true);
    try {
      const result = await onUpdate(formData);
      if (result?.success) {
        onClose();
      } else {
        setError(result?.error || result?.message || 'Failed to update member');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay — clicking it closes the modal, inner dialog stops propagation
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h3 id="edit-member-title" className="text-lg font-semibold text-foreground">
              Edit Member
            </h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" disabled={loading} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Full Name</label>
              <Input
                type="text"
                placeholder={src.full_name || ''}
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                required
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email</label>
              <Input
                type="email"
                placeholder={src.email || ''}
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Role</label>
              <Select
                value={formData.role}
                onChange={(value) => handleInputChange('role', value)}
                options={[
                  { value: 'player', label: 'Player' },
                  { value: 'coach', label: 'Coach' },
                  { value: 'staff', label: 'Staff' },
                ]}
                placeholder={src.role || 'player'}
                required
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Phone Number</label>
              <Input
                type="tel"
                placeholder={src.phone_number || ''}
                value={formData.phone_number}
                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Birthday */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Birthday</label>
              <Input
                type="date"
                placeholder={normalizeBirthday(src.birthday) || ''}
                value={formData.birthday || ''} // must be yyyy-MM-dd
                onChange={(e) => handleInputChange('birthday', e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Dietary Restrictions */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Dietary Restrictions / Allergies
              </label>
              <textarea
                placeholder=""
                value={formData.allergies ?? ''}
                onChange={(e) => handleInputChange('allergies', e.target.value)}
                rows={3}
                disabled={loading}
                className="text-sm w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Active Status */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is_active"
                checked={!!formData.is_active}
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
                  {src.joined_at ? new Date(src.joined_at).toLocaleDateString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="text-foreground font-medium">{src.is_active ? 'Active' : 'Inactive'}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              iconName={loading ? 'Loader2' : 'Save'}
              iconPosition="left"
              className={loading ? 'animate-spin' : ''}
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