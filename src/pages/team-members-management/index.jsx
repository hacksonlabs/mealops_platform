import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Icon from '../../components/AppIcon';
import MembersTable from './components/MembersTable';
import AddMemberModal from './components/AddMemberModal';
import EditMemberModal from './components/EditMemberModal';
import BulkActionsBar from './components/BulkActionsBar';
import CSVImportModal from './components/CSVImportModal';
import MemberDetailModal from './components/MemberDetailModal';
import EditTeamModal from './components/EditTeamModal';
import { toTitleCase, normalizePhoneNumber } from '../../utils/stringUtils';
import { membersToExportRows, downloadCsv, buildMembersFilename } from '../../utils/addingTeamMembersUtils';

const TeamMembersManagement = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: authLoading, teams, activeTeam, loadingTeams, refreshTeams } = useAuth();
  const [loading, setLoading] = useState(false);

  // Members state
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);

  // UI filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  const canDelete = Boolean(user?.id && activeTeam?.coach_id === user.id);

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


  // --- Load members whenever active team changes ---
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

  // --- Filtering ---
  useEffect(() => {
    let filtered = [...members];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m?.full_name?.toLowerCase().includes(q) ||
        m?.email?.toLowerCase().includes(q)
      );
    }
    if (roleFilter.length > 0) {
      filtered = filtered.filter(m => roleFilter.includes(m?.role));
    }
    setFilteredMembers(filtered);
  }, [members, searchTerm, roleFilter]);

  // --- Bulk + CRUD ---
  const handleMemberSelect = (memberId, checked) => {
    setSelectedMembers(prev =>
      checked ? [...prev, memberId] : prev.filter(id => id !== memberId)
    );
  };

  const handleSelectAll = (checked) => {
    setSelectedMembers(checked ? filteredMembers.map(m => m.id) : []);
  };

  const handleUpdateTeam = useCallback(async (updatedTeamData) => {
    if (!activeTeam?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('teams').update(updatedTeamData).eq('id', activeTeam?.id);
      if (error) throw error;
      await refreshTeams();
    } catch (error) {
      console.error('Error updating team information:', error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTeam?.id, refreshTeams]);

  const handleBulkAction = async (action) => {
    if (!activeTeam?.id || selectedMembers.length === 0) return;
    try {
      setLoading(true);

      if (action === 'activate' || action === 'deactivate') {
        const makeActive = action === 'activate';
        const { error } = await supabase
          .from('team_members')
          .update({ is_active: makeActive })
          .eq('team_id', activeTeam?.id)
          .in('id', selectedMembers);

        if (error) throw error;

        setMembers(prev =>
          prev.map(m => (selectedMembers.includes(m.id) ? { ...m, is_active: makeActive } : m))
        );
        setSelectedMembers([]);
      }

      if (action === 'delete') {
        if (!confirm(`Are you sure you want to delete ${selectedMembers.length} member(s)?`)) {
          setLoading(false);
          return;
        }
        const { error } = await supabase
          .from('team_members')
          .delete()
          .eq('team_id', activeTeam?.id)
          .in('id', selectedMembers);

        if (error) throw error;

        setMembers(prev => prev.filter(m => !selectedMembers.includes(m.id)));
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
  };

  const handleAddMember = async (memberData) => {
    if (!activeTeam?.id) return { success: false, error: 'No team found.' };
    setLoading(true);
    try {
      const row = {
        team_id: activeTeam?.id,
        user_id: null,
        role: String(memberData?.role || 'player').toLowerCase(),
        full_name: toTitleCase(memberData?.name || ''),
        email: String(memberData?.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(memberData?.phone || ''),
        allergies: toTitleCase(memberData?.allergies || ''),
        birthday: memberData?.birthday || null,
        is_active: true,
      };

      const { data, error } = await supabase.from('team_members').insert(row).select().single();
      if (error) throw error;

      setMembers(prev => [data, ...prev]);
      setShowAddModal(false);
      return { success: true };
    } catch (e) {
      console.error('Add member failed:', e);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const handleEditMember = (member) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleUpdateMember = async (memberData) => {
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
        is_active: typeof memberData?.is_active === 'boolean'
          ? memberData.is_active
          : (typeof selectedMember?.is_active === 'boolean' ? selectedMember.is_active : true),
      };

      const { data, error } = await supabase
        .from('team_members')
        .update(patch)
        .eq('team_id', activeTeam?.id)
        .eq('id', selectedMember.id)
        .select()
        .single();

      if (error) throw error;

      setMembers(prev => prev.map(m => (m.id === data.id ? data : m)));
      setShowEditModal(false);
      setSelectedMember(null);
      return { success: true };
    } catch (e) {
      console.error('Update member failed:', e);
      return { success: false, error: e.message };
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (!activeTeam?.id || !member?.id) return;
    if (!confirm(`Are you sure you want to remove ${member?.full_name || 'this member'} from the team?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', activeTeam?.id)
        .eq('id', member.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== member.id));
    } catch (e) {
      console.error('Delete member failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  };

  const handleCreateTeam = () =>
    navigate('/team-setup', { state: { next: '/team-members-management', source: 'team-tab' } 
  });

  const handleExportMembers = (onlySelected = false) => {
   const source = onlySelected
     ? members.filter(m => selectedMembers.includes(m.id))
     : filteredMembers;
   const rows = membersToExportRows(source);
   const filename = buildMembersFilename(activeTeam, {
     selectedCount: onlySelected ? rows.length : null,
     totalCount: onlySelected ? null : rows.length,
     ext: 'csv',
   });
   downloadCsv({ rows, filename });
 };

  const handleCSVImport = async (csvData) => {
    if (!activeTeam?.id) return;
    setLoading(true);
    setShowCSVModal(false);
    try {
      const rows = csvData.map(r => ({
        team_id: activeTeam?.id,
        user_id: null,
        role: String(r.role || 'player').toLowerCase(),
        full_name: toTitleCase(r.name || ''),
        email: String(r.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(r.phoneNumber || ''),
        allergies: toTitleCase(r.allergies || ''),
        birthday: r.birthday || null,
        is_active: true,
      }));

      const { data, error } = await supabase.from('team_members').insert(rows).select();
      if (error) throw error;
      setMembers(prev => [...data, ...prev]);
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTeam = async (team) => {
    try {
      if (!activeTeam?.id) {
        return { success: false, error: 'Missing team id.' };
      }
      // Delete the team (RLS allows only the coach to do this)
      const { error: delErr } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id);

      if (delErr) {
        return { success: false, error: delErr.message || 'Unable to delete team.' };
      }

      await refreshTeams();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to delete team.' };
    }
  };

  const memberStats = {
    total: members?.length || 0,
    active: members?.filter(m => m?.is_active)?.length || 0,
    coaches: members?.filter(m => m?.role === 'coach')?.length || 0,
    players: members?.filter(m => m?.role === 'player')?.length || 0,
    staff: members?.filter(m => m?.role === 'staff')?.length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            {/* Left: title/description NEVER moves */}
            <div className="flex-1">
              <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3">
                {activeTeam?.name || 'Team'} {toTitleCase(activeTeam?.gender) || ''} {activeTeam?.sport || ''}
              </h1>
              <p className="text-lg text-muted-foreground mb-4">
                Manage members, roles, and contact information for the{' '}
                <span className="font-semibold text-foreground">{activeTeam?.name || 'team'}</span>.
              </p>

              {activeTeam?.conference_name && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-700/10 border border-purple-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
                    <Icon name="ClipboardList" size={20} className="text-purple-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Conference</p>
                      <strong className="text-base text-foreground font-semibold">{activeTeam.conference_name}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right: TEAM CONTROLS ONLY New Team + Edit Team) */}
            <div className="flex items-center gap-2">
              {/* show a “New Team” button */}
              {teams.length > 0 && (
                <Button onClick={handleCreateTeam} iconName="Plus" iconPosition="left" variant="outline">
                  New Team
                </Button>
              )}

              {activeTeam?.id && (
                <Button variant="outline" onClick={() => setShowEditTeamModal(true)} iconName="Edit" iconPosition="left">
                  Edit Team
                </Button>
              )}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
          <div className="bg-card border border-border rounded-lg p-6 shadow-athletic mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              {/* Left: search + role filter */}
              <div className="flex flex-1 items-center space-x-4">
                <div className="relative flex-1">
                  <Icon
                    name="Search"
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    placeholder="Search members by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="pl-10"
                  />
                </div>
                <div className="w-40">
                  <Select
                    value={roleFilter}
                    multiple
                    onChange={(vals) => setRoleFilter(vals)}
                    placeholder="Filter by Role"
                    options={[
                      { value: 'coach', label: 'Coaches' },
                      { value: 'player', label: 'Players' },
                      { value: 'staff', label: 'Staff' },
                    ]}
                  />
                </div>
              </div>

              {/* Right: roster actions (separate from team controls) */}
              <div className="flex items-center space-x-3">
                {activeTeam?.id && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => setShowCSVModal(true)}
                      iconName="Upload"
                      iconPosition="left"
                    >
                      Import CSV
                    </Button>
                    <Button
                      onClick={() => setShowAddModal(true)}
                      iconName="Plus"
                      iconPosition="left"
                      variant="outline"
                    >
                      Add Member
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  onClick={() => handleExportMembers(selectedMembers.length > 0)}
                  iconName="Download"
                  iconPosition="left"
                  aria-label={
                    selectedMembers.length > 0
                      ? `Export ${selectedMembers.length} selected members`
                      : 'Export all members'
                  }
                >
                  {selectedMembers.length > 0
                    ? `Export (${selectedMembers.length} selected)`
                    : 'Export All'}
                </Button>
              </div>
            </div>
          </div>


          {/* Bulk Actions */}
          {selectedMembers.length > 0 && (
            <BulkActionsBar
              selectedCount={selectedMembers.length}
              onBulkAction={handleBulkAction}
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
              existingMembers={members.map(m => ({ email: m.email }))}
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

          {showEditTeamModal && activeTeam && (
            <EditTeamModal
              team={activeTeam}
              canDelete={Boolean(canDelete)}
              onDeleteTeam={handleDeleteTeam}
              onClose={() => setShowEditTeamModal(false)}
              onUpdate={handleUpdateTeam}
              loading={loading}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default TeamMembersManagement;
