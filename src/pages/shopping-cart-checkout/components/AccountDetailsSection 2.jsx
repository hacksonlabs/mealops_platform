// src/pages/checkout/components/AccountDetailsSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Input from '../../../components/ui/custom/Input';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

const safe = (v) => (typeof v === 'string' ? v : '');

const AccountDetailsSection = ({ account, onChange, defaultCollapsed = true }) => {
  const { user, userProfile, activeTeam } = useAuth();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [tmRow, setTmRow] = useState(null); // team_members row for this user (prefer activeTeam)

  // --- Fetch team_members for this user, prefer the active team row ---
  useEffect(() => {
    let alive = true;
    (async () => {
      const uid = user?.id || userProfile?.id; // user_profiles.id == auth.users.id in your schema
      if (!uid) { if (alive) setTmRow(null); return; }

      try {
        // Try: active team row first
        let q = supabase
          .from('team_members')
          .select('full_name, email, phone_number, team_id, user_id, updated_at, joined_at, created_at')
          .eq('user_id', uid);

        if (activeTeam?.id) q = q.eq('team_id', activeTeam.id);

        let { data, error } = await q.order('updated_at', { ascending: false }).limit(1);
        if (error) console.error('team_members fetch error:', error.message);

        let row = Array.isArray(data) ? data[0] : data;

        // Fallback: any team_members row for user if none for active team
        if (!row && activeTeam?.id) {
          const { data: anyRows, error: anyErr } = await supabase
            .from('team_members')
            .select('full_name, email, phone_number, team_id, user_id, updated_at, joined_at, created_at')
            .eq('user_id', uid)
            .order('updated_at', { ascending: false })
            .limit(1);
          if (anyErr) console.error('team_members fallback error:', anyErr.message);
          row = Array.isArray(anyRows) ? anyRows[0] : anyRows;
        }

        if (alive) setTmRow(row || null);
      } catch (e) {
        console.error('Unexpected team_members fetch error:', e);
        if (alive) setTmRow(null);
      }
    })();
    return () => { alive = false; };
  }, [user?.id, userProfile?.id, activeTeam?.id]);

  // --- Build defaults in priority order: team_members -> user_profiles -> auth metadata ---
  const defaults = useMemo(() => {
    // 1) team_members
    const tmFull  = safe(tmRow?.full_name);
    const tmEmail = safe(tmRow?.email);
    const tmPhone = safe(tmRow?.phone_number);

    // 2) user_profiles
    const profFull  = [safe(userProfile?.first_name), safe(userProfile?.last_name)].filter(Boolean).join(' ').trim();
    const profEmail = safe(userProfile?.email);
    const profPhone = safe(userProfile?.phone);

    // 3) auth metadata (rarely used if profile exists)
    const meta = user?.user_metadata || {};
    const metaFull  = safe(meta.full_name) || safe(meta.name) ||
                      [safe(meta.given_name), safe(meta.family_name)].filter(Boolean).join(' ').trim();
    const metaPhone = safe(meta.phone);

    // Email priority: auth.email > team_members.email > user_profiles.email
    const email = safe(user?.email) || tmEmail || profEmail || '';

    return {
      full:  tmFull  || profFull  || metaFull  || '',
      phone: tmPhone || profPhone || metaPhone || '',
      email
    };
  }, [tmRow, userProfile, user]);

  // --- Prefill account when fields are missing (but keep it editable) ---
  useEffect(() => {
    if (!onChange) return;
    const needsName  = !safe(account?.contactName);
    const needsEmail = !safe(account?.email);
    const needsPhone = !safe(account?.phone);
    if (needsName || needsEmail || needsPhone) {
      onChange({
        ...account,
        contactName: needsName ? (defaults.full  || account?.contactName || '') : account?.contactName,
        email:       needsEmail ? (defaults.email || account?.email       || '') : account?.email,
        phone:       needsPhone ? (defaults.phone || account?.phone       || '') : account?.phone,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults.full, defaults.email, defaults.phone]);

  const summaryName  = safe(account?.contactName) || defaults.full  || '—';
  const summaryEmail = safe(account?.email)       || defaults.email || '—';
  const summaryPhone = safe(account?.phone)       || defaults.phone || '—';

  return (
    <div className="bg-card border border-border rounded-lg p-3 md:p-4">
      {/* Header / Summary */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-start justify-between gap-3"
        aria-expanded={!collapsed}
        aria-controls="account-details-body"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon name="User" size={18} className="text-primary shrink-0" />
            <h2 className="text-base font-semibold text-foreground">Account</h2>
          </div>
          <div className="mt-1 text-xs md:text-sm text-muted-foreground">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate max-w-[12rem] md:max-w-[16rem]" title={summaryName}>
                {summaryName}
              </span>
              <span className="text-muted-foreground/60">|</span>
              <span className="truncate max-w-[14rem] md:max-w-[20rem]" title={summaryEmail}>
                {summaryEmail}
              </span>
              <span className="text-muted-foreground/60">|</span>
              <span className="truncate max-w-[8rem]" title={summaryPhone}>
                {summaryPhone}
              </span>
            </div>
          </div>
        </div>
        <Icon
          name={collapsed ? 'ChevronDown' : 'ChevronUp'}
          size={18}
          className="text-muted-foreground mt-1 shrink-0"
        />
      </button>

      {/* Editable body */}
      {!collapsed && (
        <div id="account-details-body" className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Contact name"
            value={safe(account?.contactName)}
            onChange={(e) => onChange?.({ ...account, contactName: e.target.value })}
            placeholder="Jane Doe"
          />
          <Input
            label="Email"
            type="email"
            value={safe(account?.email)}
            onChange={(e) => onChange?.({ ...account, email: e.target.value })}
            placeholder="jane@yourteam.edu"
          />
          <Input
            label="Phone"
            type="tel"
            value={safe(account?.phone)}
            onChange={(e) => onChange?.({ ...account, phone: e.target.value })}
            placeholder="(555) 123-4567"
          />
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-2">
        Used for order updates and driver/restaurant contact.
      </p>
    </div>
  );
};

export default AccountDetailsSection;
