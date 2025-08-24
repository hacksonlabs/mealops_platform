import React, { useState, useEffect, useCallback } from 'react';
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
import FilterPanel from './components/FilterPanel';
import MemberDetailModal from './components/MemberDetailModal';
import EditTeamModal from './components/EditTeamModal';
import { toTitleCase, normalizePhoneNumber} from '../../utils/stringUtils';


const TeamMembersManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState([]); 
  // const [statusFilter, setStatusFilter] = useState('all');
  // const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false); 
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamId, setTeamId] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);

  const { user, userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user?.id) {
      loadTeamData();
    }
  }, [authLoading, user?.id]);

  // Filter members when search term or filters change
  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, roleFilter]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        console.error('User ID is not available.');
        setLoading(false);
        return;
      }
  
      // Find the team associated with the user's coach_id
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('id, name, sport, conference_name, gender')
        .eq('coach_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (teamError) {
        console.error('Error fetching team:', teamError.message);
        setLoading(false);
        return;
      }

      if (!teamData) {
        // No team yet: send them to setup, then back here when done
        setMembers([]);
        setTeamInfo(null);
        setLoading(false);
        navigate('/team-setup', { replace: true, state: { next: '/team-members-management', source: 'team-tab' } });
        return;
      }
      setTeamId(teamData.id);
      setTeamInfo(teamData); // Save all team data to state

      // Fetch team members with the found team_id and join with user_profiles
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamData.id);

      if (membersError) {
        console.error('Error fetching team members:', membersError.message);
      } else {
        setMembers(membersData || []);
      }
    } catch (error) {
      console.error('Error loading team data:', error?.message);
    } finally {
      setLoading(false);
    }
  };

  
  const filterMembers = () => {
    let filtered = [...members];

    // Search filter
    if (searchTerm) {
      filtered = filtered?.filter(member =>
        member?.full_name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
        member?.email?.toLowerCase()?.includes(searchTerm?.toLowerCase())
      );
    }

    // Role filter
    if (roleFilter.length > 0) {
      filtered = filtered?.filter(member => roleFilter.includes(member?.role));
    }


    // // Status filter
    // if (statusFilter !== 'all') {
    //   const isActive = statusFilter === 'active';
    //   filtered = filtered?.filter(member => member?.is_active === isActive);
    // }

    setFilteredMembers(filtered);
  };

  const handleMemberSelect = (memberId, checked) => {
    if (checked) {
      setSelectedMembers([...selectedMembers, memberId]);
    } else {
      setSelectedMembers(selectedMembers?.filter(id => id !== memberId));
    }
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedMembers(filteredMembers?.map(member => member?.id));
    } else {
      setSelectedMembers([]);
    }
  };

  const handleUpdateTeam = useCallback(async (updatedTeamData) => {
    if (!teamId) {
      console.error('Team ID is not available for update.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from('teams')
        .update(updatedTeamData)
        .eq('id', teamId);

      if (error) throw error;
      await loadTeamData();
      console.log('Team information updated successfully!');
    } catch (error) {
      console.error('Error updating team information:', error.message);
    } finally {
      setLoading(false);
    }
  }, [teamId, loadTeamData]);

  const handleBulkAction = async (action) => {
    if (!teamId || selectedMembers.length === 0) return;

    try {
      setLoading(true);

      if (action === 'activate' || action === 'deactivate') {
        const makeActive = action === 'activate';
        const { data, error } = await supabase
          .from('team_members')
          .update({ is_active: makeActive })
          .eq('team_id', teamId)
          .in('id', selectedMembers)
          .select();

        if (error) throw error;

        // optimistic local update
        setMembers(prev =>
          prev.map(m =>
            selectedMembers.includes(m.id) ? { ...m, is_active: makeActive } : m
          )
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
          .eq('team_id', teamId)
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
    if (!teamId) return { success: false, error: 'No team found.' };
    setLoading(true);
    try {
      const row = {
        team_id: teamId,
        user_id: null,
        role: String(memberData?.role || 'player').toLowerCase(),
        full_name: toTitleCase(memberData?.name || ''),
        email: String(memberData?.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(memberData?.phone || ''),
        allergies: toTitleCase(memberData?.allergies || ''),
        birthday: memberData?.birthday || null,
        is_active: true,
      };

      const { data, error } = await supabase
        .from('team_members')
        .insert(row)
        .select()
        .single();

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
    if (!teamId || !selectedMember?.id) {
      return { success: false, error: 'No member selected.' };
    }
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
        .eq('team_id', teamId)
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
    if (!teamId || !member?.id) return;
    if (!confirm(`Are you sure you want to remove ${member?.full_name || 'this member'} from the team?`)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', teamId)
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


  const handleExportMembers = (onlySelected = false) => {
    // if bulk-exporting, use the selected IDs against the full members list
    const rowsToExport = onlySelected
      ? members.filter((m) => selectedMembers.includes(m.id))
      : filteredMembers;

    const csvContent = [
      ['Name', 'Email', 'Role', 'Phone', 'Allergies', 'Status', 'Joined Date'],
      ...rowsToExport.map(m => [
        m.full_name || '',
        m.email || '',
        m.role || '',
        m.phone_number || '',
        m.allergies || '',
        m.is_active ? 'Active' : 'Inactive',
        new Date(m.created_at || m.joined_at || Date.now()).toLocaleDateString() || ''
      ])
    ];

    const csv = csvContent.map(row =>
      row
        .map(cell => {
          const s = String(cell ?? '');
          // simple CSV escape for commas/quotes/newlines
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-members-${new Date().toISOString().split('T')[0]}${onlySelected ? '-selected' : ''}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };


  const handleCSVImport = async (csvData) => {
    if (!teamId) return;
    setLoading(true);
    setShowCSVModal(false);

    try {
      // csvData rows are normalized: { name, email, phoneNumber, role, allergies, birthday }
      const rows = csvData.map(r => ({
        team_id: teamId,
        user_id: null,
        role: String(r.role || 'player').toLowerCase(),
        full_name: toTitleCase(r.name || ''),
        email: String(r.email || '').toLowerCase(),
        phone_number: normalizePhoneNumber(r.phoneNumber || ''),
        allergies: toTitleCase(r.allergies || ''),
        birthday: r.birthday || null,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from('team_members')
        .insert(rows)
        .select();

      if (error) throw error;

      setMembers(prev => [...data, ...prev]);
    } catch (e) {
      console.error('Import failed:', e);
    } finally {
      setLoading(false);
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
            <div className="flex-1"> {/* Added flex-1 to allow it to take available space */}
              <h1 className="text-4xl font-extrabold text-foreground mb-3 leading-tight"> {/* Larger, bolder title */}
                {teamInfo?.name || 'Team'} {toTitleCase(teamInfo?.gender) || ''} {teamInfo?.sport || ''}
              </h1>
              <p className="text-lg text-muted-foreground mb-4"> {/* Slightly larger description */}
                Manage members, roles, and contact information for the <span className="font-semibold text-foreground">{teamInfo?.name || 'team'}</span>.
              </p>
              {teamInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                  {/* {teamInfo.sport && (
                    <div className="bg-gradient-to-br from-blue-500/10 to-blue-700/10 border border-blue-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
                      <Icon name="Dumbbell" size={20} className="text-blue-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Sport</p>
                        <strong className="text-base text-foreground font-semibold">{teamInfo.sport}</strong>
                      </div>
                    </div>
                  )} */}
                  {teamInfo.conference_name && (
                    <div className="bg-gradient-to-br from-purple-500/10 to-purple-700/10 border border-purple-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
                      <Icon name="ClipboardList" size={20} className="text-purple-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Conference</p>
                        <strong className="text-base text-foreground font-semibold">{teamInfo.conference_name}</strong>
                      </div>
                    </div>
                  )}
                  {/* {teamInfo.gender && (
                    <div className="bg-gradient-to-br from-green-500/10 to-green-700/10 border border-green-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
                      <Icon name={teamInfo.gender === 'mens' ? 'UsersRound' : (teamInfo.gender === 'womens' ? 'UserRound' : 'Users')} size={20} className="text-green-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Gender</p>
                        <strong className="text-base text-foreground font-semibold">{toTitleCase(teamInfo.gender)}</strong>
                      </div>
                    </div>
                  )} */}
                </div>
              )}
              {/* <h1 className="text-3xl font-bold text-foreground mb-2">Team Members</h1>
              <p className="text-muted-foreground">
                Manage your team members, roles, and contact information
              </p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <span>{memberStats?.total} members</span>
                <span>•</span>
                <span>{memberStats?.active} active</span>
              </div> */}
            </div>
            <div className="flex items-center space-x-3">
              {teamInfo && ( // Only show edit button if team info is loaded
                <Button
                  variant="outline"
                  onClick={() => setShowEditTeamModal(true)}
                  iconName="Edit"
                  iconPosition="left"
                >
                  Edit Team
                </Button>
              )}
              {teamInfo && (
                <Button
                  variant="outline"
                  onClick={() => setShowCSVModal(true)}
                  iconName="Upload"
                  iconPosition="left"
                >
                  Import CSV
                </Button>
              )}
              {teamInfo && (
                <Button
                  onClick={() => setShowAddModal(true)}
                  iconName="Plus"
                  iconPosition="left"
                >
                  Add Member
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
                  <p className="text-2xl font-bold text-foreground">{memberStats?.total}</p>
                </div>
                <Icon name="Users" size={24} className="text-primary" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Players</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.players}</p>
                </div>
                <Icon name="UserRound" size={24} className="text-blue-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Coaches</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.coaches}</p>
                </div>
                <Icon name="Trophy" size={24} className="text-purple-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Staff Members</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.staff}</p>
                </div>
                <Icon name="Briefcase" size={24} className="text-gray-600" />
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-athletic mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-1 items-center space-x-4">
                <div className="relative flex-1">
                  <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
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
                    multiple={true}
                    onChange={(newlySelectedValues) => {
                      setRoleFilter(newlySelectedValues);
                    }}
                    placeholder='Filter by Role'
                    options={[
                      { value: 'coach', label: 'Coaches' },
                      { value: 'player', label: 'Players' },
                      { value: 'staff', label: 'Staff' },
                    ]}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {/* <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                  iconName="Filter"
                  iconPosition="left"
                >
                  {showFilters ? 'Hide Filters' : 'Show Filters'}
                </Button> */}
                <Button
                  variant="outline"
                  onClick={() => handleExportMembers(false)}
                  iconName="Download"
                  iconPosition="left"
                >
                  Export
                </Button>
              </div>
            </div>

            {/* {showFilters && (
              <div className="mt-6 pt-6 border-t border-border">
                <FilterPanel 
                  members={members}
                  onFilterChange={() => {}} // Add filter logic here
                />
              </div>
            )} */}
          </div>

          {/* Bulk Actions Bar */}
          {selectedMembers?.length > 0 && (
            <BulkActionsBar
              selectedCount={selectedMembers?.length}
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

          {showEditTeamModal && teamInfo && (
            <EditTeamModal
              team={teamInfo}
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