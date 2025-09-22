// src/pages/team-members-management/tabs/MembersTab.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts';

import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import Select from '../../../components/ui/custom/Select';
import Icon from '../../../components/AppIcon';

import MembersTable from '../components/MembersTable';
import AddMemberModal from '../components/AddMemberModal';
import EditMemberModal from '../components/EditMemberModal';
import BulkActionsBar from '../components/BulkActionsBar';
import CSVImportModal from '../components/CSVImportModal';
import MemberDetailModal from '../components/MemberDetailModal';

import { toTitleCase, normalizePhoneNumber } from '../../../utils/stringUtils';
import { membersToExportRows, downloadCsv, buildMembersFilename } from '../../../utils/addingTeamMembersUtils';

export default function MembersTab() {
  const navigate = useNavigate();
  const { user, loading: authLoading, teams, activeTeam, loadingTeams } = useAuth();
  const [loading, setLoading] = useState(false);

  // Members state
  const [members, setMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // UI filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // If done loading and there are no teams, send user to team setup.
  useEffect(() => {
    if (authLoading || loadingTeams) return;
    if (!teams || teams.length === 0) {
      navigate('/team-setup', {
        replace: true,
        state: { next: '/team-members-management', source: 'team-tab' },
      });
    }
  }, [authLoading, loadingTeams, teams, navigate]);

  // Load members whenever active team changes
  const loadMembers = useCallback(async (tid) => {
    if (!tid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', tid);
      if (error) throw error;
      setMembers(data || []);
      setSelectedMembers([]);
    } catch (e) {
      console.error('Error fetching team members:', e?.message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeTeam?.id) return;
    loadMembers(activeTeam.id);
  }, [activeTeam?.id, loadMembers]);

  // Filtering
  const filteredMembers = useMemo(() => {
    let filtered = [...members];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m?.full_name?.toLowerCase().includes(q) ||
          m?.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter.length > 0) {
      const set = new Set(roleFilter);
      filtered = filtered.filter((m) => set.has(m?.role));
    }
    return filtered;
  }, [members, searchTerm, roleFilter]);

  // Simple stats (no is_active)
  const memberStats = useMemo(
    () => ({
      total: members.length,
      coaches: members.filter((m) => m?.role === 'coach').length,
      players: members.filter((m) => m?.role === 'player').length,
      staff: members.filter((m) => m?.role === 'staff').length,
    }),
    [members]
  );

  // Selection
  const handleMemberSelect = useCallback((memberId, checked) => {
    setSelectedMembers((prev) => (checked ? [...prev, memberId] : prev.filter((id) => id !== memberId)));
  }, []);

  const handleSelectAll = useCallback((checked) => {
    setSelectedMembers(checked ? filteredMembers.map((m) => m.id) : []);
  }, [filteredMembers]);

  // Bulk: only delete/export now
  const handleBulkAction = useCallback(async (action) => {
    if (!activeTeam?.id || selectedMembers.length === 0) return;
    try {
      setLoading(true);

      if (action === 'delete') {
        if (!confirm(`Are you sure you want to delete ${selectedMembers.length} member(s)?`)) {
          setLoading(false);
          return;
        }
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', activeTeam.id)
          .in('id', selectedMembers);
        if (error) throw error;

        setMembers((prev) => prev.filter((m) => !selectedMembers.includes(m.id)));
        setSelectedMembers([]);
      }

      if (action === 'export') {
        handleExportMembers(true);
      }
    } catch (e) {
      console.error('Bulk action failed:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, selectedMembers]);

  // CRUD
  const handleAddMember = useCallback(async (memberData) => {
    if (!activeTeam?.id) return { success: false, error: 'No team found.' };
    setLoading(true);
    try {
      const row = {
        team_id: activeTeam.id,
        user_id: null,
        role: String(memberData?.role || 'player').toLowerCase(),
        full_name: toTitleCase(memberData?.name || ''),
        email: String(memberData?.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(memberData?.phone || ''),
        allergies: toTitleCase(memberData?.allergies || ''),
        birthday: memberData?.birthday || null,
        // no is_active
      };

      const { data, error } = await supabase
        .from('team_members')
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      setMembers((prev) => [data, ...prev]);
      setShowAddModal(false);
      return { success: true };
    } catch (e) {
      console.error('Add member failed:', e);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id]);

  const handleEditMember = useCallback((member) => {
    setSelectedMember(member);
    setShowEditModal(true);
  }, []);

  const handleUpdateMember = useCallback(async (memberData) => {
    if (!activeTeam?.id || !selectedMember?.id) return { success: false, error: 'No member selected.' };
    setLoading(true);
    try {
      const patch = {
        role: String(memberData?.role ?? selectedMember?.role ?? 'player').toLowerCase(),
        full_name: toTitleCase(memberData?.full_name ?? selectedMember?.full_name ?? ''),
        email: String(memberData?.email ?? selectedMember?.email ?? '').toLowerCase(),
        phone_number: normalizePhoneNumber(memberData?.phone_number ?? selectedMember?.phone_number ?? ''),
        allergies: toTitleCase(memberData?.allergies ?? selectedMember?.allergies ?? ''),
        birthday: memberData?.birthday ?? selectedMember?.birthday ?? null,
        // no is_active
      };

      const { data, error } = await supabase
        .from('team_members')
        .update(patch)
        .eq('team_id', activeTeam.id)
        .eq('id', selectedMember.id)
        .select()
        .single();
      if (error) throw error;

      setMembers((prev) => prev.map((m) => (m.id === data.id ? data : m)));
      setShowEditModal(false);
      setSelectedMember(null);
      return { success: true };
    } catch (e) {
      console.error('Update member failed:', e);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, selectedMember]);

  const handleRemoveMember = useCallback(async (member) => {
    if (!activeTeam?.id || !member?.id) return;
    if (!confirm(`Are you sure you want to remove ${member?.full_name || 'this member'} from the team?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', activeTeam.id)
        .eq('id', member.id);
      if (error) throw error;

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (e) {
      console.error('Delete member failed:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id]);

  const handleViewDetails = useCallback((member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  }, []);

  // Export / CSV
  const handleExportMembers = useCallback((onlySelected = false) => {
    const source = onlySelected
      ? members.filter((m) => selectedMembers.includes(m.id))
      : filteredMembers;

    const rows = membersToExportRows(source);
    const filename = buildMembersFilename(activeTeam, {
      selectedCount: onlySelected ? rows.length : null,
      totalCount: onlySelected ? null : rows.length,
      ext: 'csv',
    });
    downloadCsv({ rows, filename });
  }, [members, selectedMembers, filteredMembers, activeTeam]);

  const handleCSVImport = useCallback(async (csvData) => {
    if (!activeTeam?.id) return;
    setLoading(true);
    setShowCSVModal(false);
    try {
      const rows = csvData.map((r) => ({
        team_id: activeTeam.id,
        user_id: null,
        role: String(r.role || 'player').toLowerCase(),
        full_name: toTitleCase(r.name || ''),
        email: String(r.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(r.phoneNumber || ''),
        allergies: toTitleCase(r.allergies || ''),
        birthday: r.birthday || null,
        // no is_active
      }));

      const { data, error } = await supabase
        .from('team_members')
        .insert(rows)
        .select();
      if (error) throw error;

      setMembers((prev) => [...data, ...prev]);
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id]);

  const handleCreateTeam = useCallback(() => {
    navigate('/team-setup', {
      state: { next: '/team-members-management', source: 'team-tab' },
    });
  }, [navigate]);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {/* Mobile stats */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        {[
          { label: 'Total', icon: 'Users', value: memberStats.total },
          { label: 'Players', icon: 'UserRound', value: memberStats.players },
          { label: 'Coaches', icon: 'Trophy', value: memberStats.coaches },
          { label: 'Staff', icon: 'Briefcase', value: memberStats.staff },
        ].map((card) => (
          <div key={card.label} className="bg-card border border-border rounded-lg p-4 shadow-athletic">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase">{card.label}</p>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
              </div>
              <Icon name={card.icon} size={20} className="text-primary" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop stats */}
      <div className="hidden md:grid md:grid-cols-4 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Total Members</p>
              <p className="text-2xl font-bold text-foreground">{memberStats.total}</p>
            </div>
            <Icon name="Users" size={24} className="text-primary" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Players</p>
              <p className="text-2xl font-bold text-foreground">{memberStats.players}</p>
            </div>
            <Icon name="UserRound" size={24} className="text-blue-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Coaches</p>
              <p className="text-2xl font-bold text-foreground">{memberStats.coaches}</p>
            </div>
            <Icon name="Trophy" size={24} className="text-purple-600" />
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-sm">Staff Members</p>
              <p className="text-2xl font-bold text-foreground">{memberStats.staff}</p>
            </div>
            <Icon name="Briefcase" size={24} className="text-gray-600" />
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-card border border-border rounded-lg p-5 sm:p-6 shadow-athletic">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:space-x-4 md:gap-0 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                className="pl-10"
              />
            </div>
            <div className="w-full sm:w-48 md:w-40">
              <Select
                value={roleFilter}
                multiple
                onChange={setRoleFilter}
                placeholder="Filter by Role"
                options={[
                  { value: 'coach', label: 'Coaches' },
                  { value: 'player', label: 'Players' },
                  { value: 'staff', label: 'Staff' },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:space-x-3 sm:gap-0 w-full lg:w-auto">
            {activeTeam?.id && (
              <Button
                variant="outline"
                onClick={() => setShowAddModal(true)}
                iconName="Plus"
                iconPosition="left"
                className="w-full sm:w-auto"
              >
                Add Member
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => handleExportMembers(selectedMembers.length > 0)}
              iconName="Download"
              iconPosition="left"
              className="hidden md:inline-flex"
              aria-label={selectedMembers.length > 0
                ? `Export ${selectedMembers.length} selected members`
                : 'Export all members'}
            >
              {selectedMembers.length > 0 ? `Export (${selectedMembers.length} selected)` : 'Export All'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCSVModal(true)}
              iconName="Upload"
              iconPosition="left"
              className="hidden md:inline-flex"
            >
              Import CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions (Delete / Export only) */}
      {selectedMembers.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedMembers.length}
          onBulkAction={handleBulkAction}
          actions={['export', 'delete']} // <- see updated BulkActionsBar below
          onClearSelection={() => setSelectedMembers([])}
        />
      )}

      {/* Members Table */}
      <MembersTable
        members={filteredMembers}
        selectedMembers={selectedMembers}
        onMemberSelect={handleMemberSelect}
        onSelectAll={handleSelectAll}
        onEditMember={handleEditMember}
        onRemoveMember={handleRemoveMember}
        onViewDetails={handleViewDetails}
        loading={loading}
      />

      {/* Modals */}
      {showAddModal && (
        <AddMemberModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddMember}
          existingMembers={members}
        />
      )}

      {showEditModal && selectedMember && (
        <EditMemberModal
          member={selectedMember}
          onClose={() => {
            setShowEditModal(false);
            setSelectedMember(null);
          }}
          onUpdate={handleUpdateMember}
        />
      )}

      {showCSVModal && (
        <CSVImportModal
          onClose={() => setShowCSVModal(false)}
          onImport={handleCSVImport}
          existingMembers={members.map((m) => ({ email: m.email }))}
          currentUser={user}
        />
      )}

      {showDetailModal && selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedMember(null);
          }}
        />
      )}
    </div>
  );
}
