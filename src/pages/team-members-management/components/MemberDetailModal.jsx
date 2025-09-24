// src/pages/team-members-management/components/MemberDetailModal.jsx
import React, { useMemo, useEffect, useState } from 'react';
import Button from '../../../components/ui/custom/Button';
import Icon from '../../../components/AppIcon';
import { normalizeBirthday, formatDateToMMDDYYYY } from '../../../utils/stringUtils';
import { ROLE_CONFIG } from '../../../utils/addingTeamMembersUtils';
import { supabase } from '../../../lib/supabase';

const RoleBadge = ({ role }) => {
  const cfg =
    ROLE_CONFIG?.[role] || {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: role ? role[0].toUpperCase() + role.slice(1) : 'Member',
    };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
};

const MemberDetailModal = ({ member, onClose }) => {
  const [ordersParticipated, setOrdersParticipated] = useState(0);
  // Normalize to flat team_members shape (no is_active)
  const src = useMemo(
    () => ({
      id: member?.id ?? null,
      full_name: member?.full_name ?? '',
      email: member?.email ?? '',
      phone_number: member?.phone_number ?? '',
      role: (member?.role ?? 'player')?.toLowerCase(),
      allergies: member?.allergies ?? '',
      birthday: member?.birthday ?? null,
      joined_at: member?.joined_at ?? member?.created_at ?? null,
    }),
    [member]
  );

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose?.();
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

  // Load orders participated (scheduled, confirmed, completed)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!src.id) { setOrdersParticipated(0); return; }
      try {
        const { data, error } = await supabase
          .from('meal_orders')
          .select('id, order_status, meal_items:meal_order_items!inner(team_member_id)')
          .eq('meal_items.team_member_id', src.id)
          .in('order_status', ['scheduled', 'confirmed', 'completed']);
        if (error) throw error;
        const unique = new Set((data || []).map((row) => row.id));
        if (!cancelled) setOrdersParticipated(unique.size);
      } catch (e) {
        if (!cancelled) setOrdersParticipated(0);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [src.id]);

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
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
          <h3 id="member-details-title" className="text-lg font-semibold text-foreground">
            Member Details
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" aria-label="Close" />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          {/* Profile */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Icon name="User" size={28} className="text-primary" />
            </div>
            <div>
              <h4 className="text-xl font-semibold text-foreground">{src.full_name || '—'}</h4>
              <div className="flex items-center space-x-2 mt-2">
                <RoleBadge role={src.role} />
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
            </div>
          </div>

          {/* Stats (placeholder) */}
          <div className="space-y-4">
            <h5 className="font-medium text-foreground border-b border-border pb-2">Activity Statistics</h5>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">{ordersParticipated}</p>
                <p className="text-xs text-muted-foreground">Orders Participated</p>
              </div>
              {/* <div className="text-center p-4 bg-muted rounded-lg">
                <p className="text-lg font-semibold text-foreground">0</p>
                <p className="text-xs text-muted-foreground">Polls Participated</p>
              </div> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemberDetailModal;
