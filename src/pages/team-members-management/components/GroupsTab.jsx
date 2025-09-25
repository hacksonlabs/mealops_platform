import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts';

import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';
import PeopleTooltip from '../../../components/ui/PeopleTooltip';
import { toTitleCase } from '../../../utils/stringUtils';

export default function GroupsTab() {
  const { activeTeam } = useAuth();

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [groups, setGroups] = useState([]);

  // Search filter
  const [q, setQ] = useState('');

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [groupPendingDelete, setGroupPendingDelete] = useState(null);

  // ---- Hover tooltip state (portal, upward) for "Members" column ----
  const [hoverGroupId, setHoverGroupId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const memberAnchorRefs = useRef(new Map());
  const closeTimerRef = useRef(null);

  const setMemberAnchorRef = useCallback((id) => (node) => {
    const map = memberAnchorRefs.current;
    if (node) map.set(id, node);
    else map.delete(id);
  }, []);

  const positionTooltip = useCallback((groupId) => {
    const el = memberAnchorRefs.current.get(groupId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top, // top edge; tooltip renders upward
    });
  }, []);

  const openOnHover = (groupId) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    positionTooltip(groupId);
    setHoverGroupId(groupId);
  };

  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHoverGroupId(null), 120);
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!hoverGroupId) return;
    const handle = () => positionTooltip(hoverGroupId);
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [hoverGroupId, positionTooltip]);

  // Loaders
  const loadMembers = useCallback(async (teamId) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamId);
      if (error) throw error;
      setMembers(data || []);
    } catch (e) {
      console.error('loadMembers error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGroups = useCallback(async (teamId) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const { data: groupRows, error: gErr } = await supabase
        .from('member_groups')
        .select('id, team_id, name, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false });
      if (gErr) throw gErr;

      const ids = (groupRows || []).map((g) => g.id);
      let membershipsByGroup = {};
      if (ids.length) {
        const { data: gmRows, error: gmErr } = await supabase
          .from('member_group_members')
          .select('group_id, member_id')
          .in('group_id', ids);
        if (gmErr) throw gmErr;
        membershipsByGroup = (gmRows || []).reduce((acc, row) => {
          (acc[row.group_id] ||= []).push(row.member_id);
          return acc;
        }, {});
      }

      setGroups(
        (groupRows || []).map((g) => ({
          ...g,
          member_ids: membershipsByGroup[g.id] || [],
        }))
      );
    } catch (e) {
      console.error('loadGroups error', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTeam?.id) return;
    loadMembers(activeTeam.id);
    loadGroups(activeTeam.id);
  }, [activeTeam?.id, loadMembers, loadGroups]);

  // Derived
  const memberById = useMemo(() => {
    const map = new Map();
    members.forEach((m) => map.set(m.id, m));
    return map;
  }, [members]);

  const memberOptions = useMemo(() => {
    const formatRoleLabel = (role) => {
      const cleaned = String(role || '').trim();
      return cleaned ? toTitleCase(cleaned) : 'Other';
    };

    return (members || []).map((m) => {
      const name = m?.full_name || '';
      const email = m?.email || '';
      const roleGroup = formatRoleLabel(m?.role);

      return {
        value: m?.id,
        label: name || email || `Member ${m?.id ?? ''}`,
        search: `${name} ${email} ${roleGroup}`.trim().toLowerCase(),
        roleGroup,
      };
    });
  }, [members]);

  const filteredGroups = useMemo(() => {
    let arr = groups;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter((g) => g.name?.toLowerCase().includes(t));
    }
    return arr;
  }, [groups, q]);

  // ---- Add/Edit modal helpers ----
  const resetModal = () => {
    setGroupName('');
    setSelectedMemberIds([]);
    setEditingGroup(null);
  };

  const openCreate = () => {
    resetModal();
    setShowModal(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setGroupName(group?.name || '');
    setSelectedMemberIds(group?.member_ids || []);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetModal();
  };

  const handleSave = async () => {
    if (!groupName.trim() || !activeTeam?.id) return;
    const teamId = activeTeam.id;

    setLoading(true);
    try {
      let groupId = editingGroup?.id;

      if (!groupId) {
        const { data: created, error } = await supabase
          .from('member_groups')
          .insert({ team_id: teamId, name: groupName.trim() })
          .select('id')
          .single();
        if (error) throw error;
        groupId = created.id;
      } else {
        const { error } = await supabase
          .from('member_groups')
          .update({ name: groupName.trim() })
          .eq('id', groupId);
        if (error) throw error;

        // replace memberships
        const { error: delErr } = await supabase
          .from('member_group_members')
          .delete()
          .eq('group_id', groupId);
        if (delErr) throw delErr;
      }

      if (selectedMemberIds.length > 0) {
        const rows = selectedMemberIds.map((mid) => ({
          group_id: groupId,
          member_id: mid,
        }));
        const { error: insErr } = await supabase
          .from('member_group_members')
          .insert(rows);
        if (insErr) throw insErr;
      }

      await loadGroups(teamId);
      closeModal();
    } catch (e) {
      console.error('save group failed:', e);
    } finally {
      setLoading(false);
    }
  };

  // ---- Delete modal helpers ----
  const openDeleteModal = (group) => {
    setGroupPendingDelete(group);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setGroupPendingDelete(null);
  };

  const confirmDelete = async () => {
    const group = groupPendingDelete;
    if (!group?.id) return;
    setLoading(true);
    try {
      const { error: delMembersErr } = await supabase
        .from('member_group_members')
        .delete()
        .eq('group_id', group.id);
      if (delMembersErr) throw delMembersErr;

      const { error: delGroupErr } = await supabase
        .from('member_groups')
        .delete()
        .eq('id', group.id);
      if (delGroupErr) throw delGroupErr;

      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      closeDeleteModal();
    } catch (e) {
      console.error('delete group failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const selectedUsersLabel = (g) =>
    `${g.member_ids.length} member${g.member_ids.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4 text-sm pb-24 sm:pb-24">
      {/* Table card */}
      <div className="bg-card border border-border rounded-lg overflow-visible shadow-athletic w-full max-w-6xl mx-auto">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative w-full sm:max-w-xs">
              <Input
                aria-label="Search groups"
                placeholder="Search groups"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
              <Icon
                name="Search"
                size={16}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 sm:ml-4">
              <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground mr-1">{filteredGroups.length}</span>
                group{filteredGroups.length === 1 ? '' : 's'}
              </span>

              <Button
                iconName="Plus"
                iconPosition="left"
                onClick={openCreate}
                size="sm"
                className="shrink-0"
              >
                New Group
              </Button>
            </div>
          </div>
        </div>

        {/* Header (no team column) */}
        <div className="grid grid-cols-12 px-4 py-2 text-[11px] uppercase tracking-wide font-medium text-muted-foreground border-b border-border">
          <div className="col-span-8">Group</div>
          <div className="col-span-2">Members</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        {filteredGroups.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No groups found.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredGroups.map((g) => {
              const names = (g.member_ids || []).map((mid) => {
                const m = memberById.get(mid);
                return m?.full_name || m?.email || `Member ${String(mid).slice(0, 6)}`;
              });
              const peopleEntries = (g.member_ids || []).map((mid) => {
                const m = memberById.get(mid) || {};
                return {
                  name: m?.full_name || m?.email || `Member ${String(mid).slice(0, 6)}`,
                  role: m?.role || undefined,
                };
              });

              return (
                <li key={g.id} className="grid grid-cols-12 px-4 py-3 items-center">
                  {/* Group */}
                  <div className="col-span-8">
                    <div className="text-foreground">{g.name}</div>
                  </div>

                  {/* Members (hover tooltip upward via PeopleTooltip) */}
                  <div className="col-span-2">
                    <div
                      className="relative inline-block"
                      ref={setMemberAnchorRef(g.id)}
                      onMouseEnter={() => openOnHover(g.id)}
                      onMouseLeave={scheduleClose}
                      title={names.join(', ')} // mobile fallback
                    >
                      <span className="text-primary underline flex items-center gap-1 cursor-default">
                        <Icon name="Users" size={16} />
                        {selectedUsersLabel(g)}
                      </span>

                      <PeopleTooltip
                        open={hoverGroupId === g.id}
                        x={tooltipPos.x}
                        y={tooltipPos.y}
                        names={peopleEntries}
                        totalCount={peopleEntries.length}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                        title="Members"
                        width={320}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 text-right">
                    <div className="inline-flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(g)}
                        iconName="Edit"
                        title="Edit Group"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDeleteModal(g)}
                        iconName="Trash2"
                        title="Delete Group"
                        className="text-red-600 hover:text-red-700"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-athletic w-full max-w-xl p-5 sm:p-6 text-sm mx-4 sm:mx-0"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">
                {editingGroup ? 'Edit Group' : 'Add Group'}
              </h3>
              <button
                className="text-muted-foreground hover:text-foreground"
                onClick={closeModal}
                aria-label="Close"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Group Name</label>
                <Input
                  autoFocus
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Name"
                  className="h-9"
                />
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">Members</label>
                <Select
                  multiple
                  searchable
                  options={memberOptions}
                  value={selectedMemberIds}
                  onChange={(vals) => setSelectedMemberIds(Array.isArray(vals) ? vals : [])}
                  placeholder="Search and select members…"
                  selectedNoun="members"
                  groupBy="roleGroup"
                  groupConfig={{
                    order: ['Players', 'Coaches', 'Staff', 'Other'],
                    fallbackLabel: 'Other',
                    columnMinWidth: 180,
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={loading || !groupName.trim()}>
                {editingGroup ? 'Save changes' : 'Create group'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div
            className="bg-card border border-border rounded-xl shadow-athletic w-full max-w-sm p-4 sm:p-5 text-sm mx-4 sm:mx-0"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon name="TriangleAlert" />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-foreground">Delete group?</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  This will permanently delete{' '}
                  <span className="font-medium text-foreground">
                    “{groupPendingDelete?.name || 'this group'}”
                  </span>{' '}
                  and remove all of its member assignments.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeDeleteModal}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:opacity-90"
                onClick={confirmDelete}
                disabled={loading}
                iconName="Trash2"
                iconPosition="left"
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
