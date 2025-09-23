// src/pages/checkout/components/TeamAssignments.jsx
import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import { expandItemsToUnitRows } from '../../../utils/cartDisplayUtils';

const labelize = (role) =>
  String(role || 'Unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());

/** Preferred role order; unknowns fall to the end */
const ROLE_ORDER = [
  'head_coach',
  'coach',
  'assistant_coach',
  'trainer',
  'manager',
  'captain',
  'player',
  'staff',
  'volunteer',
  'other',
  'unknown',
];

const roleRank = (role) => {
  const i = ROLE_ORDER.indexOf(String(role || 'unknown').toLowerCase());
  return i === -1 ? ROLE_ORDER.length : i;
};

const TeamAssignments = ({ items = [], teamMembers: teamMembersProp }) => {
  const [open, setOpen] = useState(false); // closed by default
  const { activeTeam } = useAuth();
  const [teamMembers, setTeamMembers] = useState(teamMembersProp || []);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch team_members if not provided
  useEffect(() => {
    let alive = true;
    const fetchMembers = async () => {
      if (teamMembersProp && teamMembersProp.length) return;
      if (!activeTeam?.id) return;
      setLoadingMembers(true);
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, full_name, role')
          .eq('team_id', activeTeam.id)
          .order('full_name', { ascending: true });
        if (error) throw error;
        if (alive) setTeamMembers(data || []);
      } catch (e) {
        console.error('Failed to load team_members:', e?.message || e);
        if (alive) setTeamMembers([]);
      } finally {
        if (alive) setLoadingMembers(false);
      }
    };
    fetchMembers();
    return () => { alive = false; };
  }, [activeTeam?.id, teamMembersProp]);

  // Map name -> role (case-insensitive match on full_name)
  const roleByName = useMemo(() => {
    const map = new Map();
    for (const m of teamMembers || []) {
      const nm = String(m?.full_name || '').trim();
      if (!nm) continue;
      map.set(nm.toLowerCase(), String(m?.role || 'unknown').toLowerCase());
    }
    return map;
  }, [teamMembers]);

  // Build: counts per NAME (# of items assigned), extras, plus role grouping
  const {
    namesSorted,
    itemsCountByName,
    memberCount,
    extrasTotal,
    unassignedTotal,
    roleGroups,      // { role: [{ name, count }] }
    roleCountsOrder, // [{ role, count }] sorted by role order
  } = useMemo(() => {
    const perUnitRows = expandItemsToUnitRows(items || []);

    const counts = new Map(); // name -> number of units
    let extras = 0;
    let unassigned = 0;

    for (const row of perUnitRows) {
      const nm = String(row?.assignee || '').trim();
      if (!nm) { unassigned += 1; continue; }
      if (nm === 'Extra') { extras += 1; continue; }
      if (nm === 'Unassigned') { unassigned += 1; continue; }
      counts.set(nm, (counts.get(nm) || 0) + 1);
    }

    // Build role groups
    const roleGroupsTmp = {};
    const roleCountsTmp = new Map(); // role -> #people with assignments
    const names = Array.from(counts.keys());

    for (const nm of names) {
      const role = roleByName.get(nm.toLowerCase()) || 'unknown';
      if (!roleGroupsTmp[role]) roleGroupsTmp[role] = [];
      roleGroupsTmp[role].push({ name: nm, count: counts.get(nm) || 1 });

      // count unique people per role
      roleCountsTmp.set(role, (roleCountsTmp.get(role) || 0) + 1);
    }

    // Sort each role group by name; order roles by ROLE_ORDER
    const orderedRoleKeys = Object.keys(roleGroupsTmp).sort((a, b) => {
      const ra = roleRank(a);
      const rb = roleRank(b);
      if (ra !== rb) return ra - rb;
      return a.localeCompare(b);
    });
    for (const k of orderedRoleKeys) {
      roleGroupsTmp[k].sort((a, b) => a.name.localeCompare(b.name));
    }

    const roleCountsOrder = orderedRoleKeys.map((r) => ({ role: r, count: roleCountsTmp.get(r) || 0 }));

    // Flat names (sorted by role then name) if you ever want a single grid
    const namesSorted = orderedRoleKeys.flatMap((r) => roleGroupsTmp[r].map((x) => x.name));

    return {
      namesSorted,
      itemsCountByName: Object.fromEntries(counts),
      memberCount: names.length,
      extrasTotal: extras,
      unassignedTotal: unassigned,
      roleGroups: roleGroupsTmp,
      roleCountsOrder,
    };
  }, [items, roleByName]);

  return (
    <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Icon name="Users" size={18} className="text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Team Memebers On Order</h2>
          <span className="ml-2 text-xs px-2 py-0.5 rounded-full border border-border bg-muted/50 tabular-nums">
            {memberCount}
            {extrasTotal > 0 && <> + {extrasTotal} extra{extrasTotal === 1 ? '' : 's'}</>}
            {unassignedTotal > 0 && <> + {unassignedTotal} unassigned</>}
          </span>
        </div>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={18} className="text-muted-foreground" />
      </button>

      {/* Body */}
      {open && (
        <>
          {/* Role tally row */}
          <div className="mt-4 flex flex-wrap gap-2">
            {loadingMembers && (
              <span className="text-xs text-muted-foreground">Loading roles…</span>
            )}
            {!loadingMembers && roleCountsOrder.length === 0 && (
              <span className="text-xs text-muted-foreground">No assignments yet.</span>
            )}
            {!loadingMembers &&
              roleCountsOrder.map(({ role, count }) => (
                <span
                  key={role}
                  className="text-xs px-2 py-0.5 rounded-full border border-border bg-muted/40 tabular-nums"
                  title={`${labelize(role)}: ${count}`}
                >
                  {labelize(role)}: <span className="font-medium">{count}</span>
                </span>
              ))}
          </div>

          {/* Grouped by role */}
          {Object.keys(roleGroups).length > 0 && (
            <div className="mt-4 space-y-5">
              {Object.keys(roleGroups)
                .sort((a, b) => roleRank(a) - roleRank(b) || a.localeCompare(b))
                .map((role) => {
                  const people = roleGroups[role] || [];
                  if (!people.length) return null;
                  return (
                    <section key={role}>
                      <div className="flex items-center gap-2 mb-2">
                        <Icon name="Tag" size={14} className="text-muted-foreground" />
                        <h3 className="text-sm font-semibold text-foreground">
                          {labelize(role)} <span className="text-muted-foreground">({people.length})</span>
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {people.map(({ name, count }) => (
                          <div
                            key={name}
                            className="border border-border rounded-md px-3 py-2 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon name="User" size={14} className="text-muted-foreground shrink-0" />
                              <span className="text-sm font-medium truncate">{name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {count > 1 && (
                                <span className="text-xs text-muted-foreground tabular-nums">×{count}</span>
                              )}
                              <Icon name="CheckCircle" size={16} className="text-success" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
            </div>
          )}

          {extrasTotal > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Includes {extrasTotal} extra{extrasTotal === 1 ? '' : 's'}.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default TeamAssignments;
