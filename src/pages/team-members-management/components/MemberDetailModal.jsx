import React, { useMemo, useEffect } from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';
import { normalizeBirthday, formatDateToMMDDYYYY } from '../../../utils/stringUtils';

const MemberDetailModal = ({ member, onClose }) => {
  // Normalize to the flat team_members shape
  const src = useMemo(
    () => ({
      id: member?.id ?? null,
      full_name: member?.full_name ?? '',
      email: member?.email ?? '',
      phone_number: member?.phone_number ?? '',
      role: (member?.role ?? 'player')?.toLowerCase(),
      allergies: member?.allergies ?? '',
      birthday: member?.birthday ?? null,
      is_active: typeof member?.is_active === 'boolean' ? member.is_active : true,
      joined_at: member?.joined_at ?? member?.created_at ?? null,
    }),
    [member]
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Date display helpers
  const displayBirthday = (v) => {
    const ymd = normalizeBirthday(v);
    const out = formatDateToMMDDYYYY(ymd);
    return out || '—';
  };

  const displayJoinedAt = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  const getRoleBadge = (role) => {
    const roleConfig = {
      coach:  { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Coach' },
      player: { bg: 'bg-blue-100',   text: 'text-blue-800',   label: 'Player' },
      staff:  { bg: 'bg-gray-100',  text: 'text-gray-800',  label: 'Staff' },
    };
    const config =
      roleConfig[role] || { bg: 'bg-gray-100', text: 'text-gray-800', label: role ? role[0].toUpperCase() + role.slice(1) : 'Member' };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (isActive) =>
    isActive ? (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5" />
        Active
      </span>
    ) : (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <span className="w-1.5 h-1.5 bg-red-400 rounded-full mr-1.5" />
        Inactive
      </span>
    );

  return (
    // Overlay — close only when clicking the overlay, not the dialog
    <div
      className="fixed inset-0 bg-black/50 z-50 p-4 flex items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      onTouchStart={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
      role="presentation"
    >
      {/* Dialog container — header/footer fixed, body scrolls */}
      <div
        className="bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-lg max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-details-title"
      >
        {/* Header (non-scrolling) */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h3 id="member-details-title" className="text-lg font-semibold text-foreground">
            Member Details
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" aria-label="Close" />
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {/* Profile */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="User" size={28} className="text-primary" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-foreground">{src.full_name || '—'}</h4>
              <p className="text-muted-foreground">{src.email || '—'}</p>
              <div className="flex items-center space-x-2 mt-2">
                {getRoleBadge(src.role)}
                {getStatusBadge(src.is_active)}
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">Contact Information</h5>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <Icon name="Mail" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Email</p>
                  <p className="text-sm text-muted-foreground">{src.email || 'Not provided'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Phone" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Phone</p>
                  <p className="text-sm text-muted-foreground">{src.phone_number || 'Not provided'}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Cake" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Birthday</p>
                  <p className="text-sm text-muted-foreground">{displayBirthday(src.birthday)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Health */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">Health Information</h5>
            <div className="flex items-start space-x-3">
              <Icon name="AlertTriangle" size={16} className="text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Dietary Restrictions / Allergies</p>
                <div className="mt-1">
                  {src.allergies ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800">{src.allergies}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No restrictions specified</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Team */}
          <div className="space-y-4 mb-6">
            <h5 className="font-medium text-foreground border-b border-border pb-2">Team Information</h5>
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center space-x-3">
                <Icon name="Calendar" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Joined Team</p>
                  <p className="text-sm text-muted-foreground">{displayJoinedAt(src.joined_at)}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Shield" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Role</p>
                  <p className="text-sm text-muted-foreground">
                    {src.role ? src.role.charAt(0).toUpperCase() + src.role.slice(1) : '—'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Icon name="Activity" size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium text-foreground">Status</p>
                  <p className="text-sm text-muted-foreground">{src.is_active ? 'Active member' : 'Inactive member'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats (placeholder) */}
          <div className="space-y-4">
            <h5 className="font-medium text-foreground border-b border-border pb-2">Activity Statistics</h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Orders Participated</p>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Polls Participated</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer (non-scrolling) */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border shrink-0">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
};

export default MemberDetailModal;