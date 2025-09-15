// src/pages/team-members-management/components/EditMemberModal.jsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import { toTitleCase, normalizePhoneNumber, normalizeBirthday } from '../../../utils/stringUtils';

const ROLE_OPTIONS = [
  { value: 'player', label: 'Player' },
  { value: 'coach', label: 'Coach' },
  { value: 'staff', label: 'Staff' },
];

const EditMemberModal = ({ member, onClose, onUpdate }) => {
  // Normalize incoming member → flat `team_members` shape (no is_active here)
  const src = useMemo(
    () => ({
      id: member?.id ?? null,
      full_name: member?.full_name ?? '',
      email: member?.email ?? '',
      phone_number: member?.phone_number ?? '',
      role: (member?.role ?? 'player')?.toLowerCase(),
      allergies: member?.allergies ?? '',
      birthday: normalizeBirthday(member?.birthday ?? ''), // yyyy-MM-dd or ''
      joined_at: member?.joined_at ?? member?.created_at ?? null,
    }),
    [member]
  );

  // Local form state
  const [form, setForm] = useState({
    full_name: toTitleCase(src.full_name),
    email: (src.email || '').toLowerCase(),
    phone_number: normalizePhoneNumber(src.phone_number),
    role: src.role,
    allergies: toTitleCase(src.allergies),
    birthday: src.birthday, // must stay yyyy-MM-dd for <input type="date" />
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Keep form in sync when `member` changes
  useEffect(() => {
    setForm({
      full_name: toTitleCase(src.full_name),
      email: (src.email || '').toLowerCase(),
      phone_number: normalizePhoneNumber(src.phone_number),
      role: src.role,
      allergies: toTitleCase(src.allergies),
      birthday: src.birthday,
    });
  }, [src]);

  // Close on ESC
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Close on backdrop click (not when clicking dialog)
  const overlayRef = useRef(null);
  const handleOverlayMouseDown = useCallback(
    (e) => {
      if (e.target === overlayRef.current) onClose?.();
    },
    [onClose]
  );

  // Helpers
  const setField =
    (field, transform) =>
    (eOrVal) => {
      const raw = typeof eOrVal === 'string' ? eOrVal : eOrVal?.target?.value ?? '';
      const next = transform ? transform(raw) : raw;
      setForm((prev) => ({ ...prev, [field]: next }));
      if (error) setError('');
    };

  const onNameChange = setField('full_name'); // we’ll normalize on submit
  const onEmailChange = setField('email');
  const onPhoneChange = setField('phone_number'); // normalize on blur
  const onBirthdayChange = setField('birthday'); // already yyyy-MM-dd
  const onAllergiesChange = setField('allergies'); // normalize on submit
  const onRoleChange = (val) => setField('role')(val);

  const handlePhoneBlur = () =>
    setForm((p) => ({ ...p, phone_number: normalizePhoneNumber(p.phone_number) }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');

    if (!form.full_name?.trim()) {
      setError('Full name is required.');
      return;
    }
    if (!form.email?.trim()) {
      setError('Email is required.');
      return;
    }

    // Final normalized payload
    const payload = {
      full_name: toTitleCase((form.full_name || '').trim()),
      email: (form.email || '').toLowerCase().trim(),
      phone_number: normalizePhoneNumber(form.phone_number || ''),
      role: (form.role || 'player').toLowerCase(),
      allergies: toTitleCase((form.allergies || '').trim()),
      birthday: normalizeBirthday(form.birthday || ''), // keep yyyy-MM-dd or ''
    };

    setLoading(true);
    try {
      const result = await onUpdate?.(payload);
      if (result?.success) onClose?.();
      else setError(result?.error || result?.message || 'Failed to update member.');
    } catch {
      setError('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onMouseDown={handleOverlayMouseDown}
      onTouchStart={handleOverlayMouseDown}
      role="presentation"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-md max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-member-title"
        aria-describedby={error ? 'edit-member-error' : undefined}
        aria-busy={loading || undefined}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 id="edit-member-title" className="text-lg font-semibold text-foreground">
            Edit Member
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" disabled={loading} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6" noValidate>
          <div className="space-y-4">
            {/* Full Name */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-foreground mb-2">
                Full Name
              </label>
              <Input
                id="full_name"
                type="text"
                placeholder={src.full_name || ''}
                value={form.full_name}
                onChange={onNameChange}
                required
                disabled={loading}
                aria-invalid={!!error && !form.full_name}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder={src.email || ''}
                value={form.email}
                onChange={onEmailChange}
                required
                disabled={loading}
                aria-invalid={!!error && !form.email}
              />
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">
                Role
              </label>
              <Select
                id="role"
                value={form.role}
                onChange={onRoleChange}
                options={ROLE_OPTIONS}
                placeholder={src.role || 'player'}
                required
                disabled={loading}
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-foreground mb-2">
                Phone Number
              </label>
              <Input
                id="phone_number"
                type="tel"
                placeholder={src.phone_number || ''}
                value={form.phone_number}
                onChange={onPhoneChange}
                onBlur={handlePhoneBlur}
                disabled={loading}
              />
            </div>

            {/* Birthday */}
            <div>
              <label htmlFor="birthday" className="block text-sm font-medium text-foreground mb-2">
                Birthday
              </label>
              <Input
                id="birthday"
                type="date"
                placeholder={src.birthday || ''}
                value={form.birthday || ''} // yyyy-MM-dd
                onChange={onBirthdayChange}
                disabled={loading}
              />
            </div>

            {/* Dietary Restrictions */}
            <div>
              <label htmlFor="allergies" className="block text-sm font-medium text-foreground mb-2">
                Dietary Restrictions / Allergies
              </label>
              <textarea
                id="allergies"
                value={form.allergies ?? ''}
                onChange={onAllergiesChange}
                rows={3}
                disabled={loading}
                className="text-sm w-full px-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed resize-none"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div
                id="edit-member-error"
                role="alert"
                className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2"
              >
                <Icon name="AlertCircle" size={16} className="text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
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
            >
              {loading ? 'Updating…' : 'Update Member'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditMemberModal;
