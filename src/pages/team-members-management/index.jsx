import React, { useState, useEffect } from 'react';
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


const TeamMembersManagement = () => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [teamId, setTeamId] = useState(null);

  const { user, userProfile, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user?.id) {
      loadTeamData();
    }
  }, [authLoading, user?.id]);

  // Filter members when search term or filters change
  useEffect(() => {
    filterMembers();
  }, [members, searchTerm, roleFilter, statusFilter]);

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
        .select('id')
        .eq('coach_id', user.id)
        .single();

      if (teamError) {
        console.error('Error fetching team:', teamError.message);
        setLoading(false);
        return;
      }

      if (!teamData) {
        console.log('No team found for this user.');
        setMembers([]);
        setLoading(false);
        return;
      }

      const foundTeamId = teamData.id;
      setTeamId(foundTeamId); // Save team ID to state

      // Fetch team members with the found team_id and join with user_profiles
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*') // Fetch all columns and join user_profiles
        .eq('team_id', foundTeamId);

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
    if (roleFilter !== 'all') {
      filtered = filtered?.filter(member => member?.role === roleFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered?.filter(member => member?.is_active === isActive);
    }

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

  const handleBulkAction = async (action) => {
    switch (action) {
      case 'activate':
        // Bulk activate members
        const activatedMembers = members?.map(member => 
          selectedMembers?.includes(member?.id) 
            ? { ...member, team_members: { ...member?.team_members, is_active: true } }
            : member
        );
        setMembers(activatedMembers);
        break;
      case 'deactivate':
        // Bulk deactivate members  
        const deactivatedMembers = members?.map(member => 
          selectedMembers?.includes(member?.id) 
            ? { ...member, team_members: { ...member?.team_members, is_active: false } }
            : member
        );
        setMembers(deactivatedMembers);
        break;
      case 'delete':
        // Bulk delete members
        if (confirm(`Are you sure you want to delete ${selectedMembers?.length} members?`)) {
          const remainingMembers = members?.filter(member => !selectedMembers?.includes(member?.id));
          setMembers(remainingMembers);
          setSelectedMembers([]);
        }
        break;
      case 'export':
        handleExportMembers();
        break;
    }
  };

  const handleAddMember = async (memberData) => {
    const newMember = {
      id: Date.now()?.toString(),
      team_members: {
        id: Date.now()?.toString(),
        full_name: memberData?.name,
        email: memberData?.email,
        phone: memberData?.phone,
        role: memberData?.role,
        allergies: memberData?.allergies || 'None',
        is_active: true
      },
      joined_at: new Date()?.toISOString()
    };

    setMembers([...members, newMember]);
    setShowAddModal(false);
    return { success: true };
  };

  const handleEditMember = (member) => {
    setSelectedMember(member);
    setShowEditModal(true);
  };

  const handleUpdateMember = async (memberData) => {
    const updatedMembers = members?.map(member => 
      member?.id === selectedMember?.id 
        ? { 
            ...member, 
            team_members: { 
              ...member?.team_members, 
              full_name: memberData?.name,
              email: memberData?.email,
              phone_number: memberData?.phone,
              role: memberData?.role,
              allergies: memberData?.allergies
            }
          }
        : member
    );

    setMembers(updatedMembers);
    setShowEditModal(false);
    setSelectedMember(null);
    return { success: true };
  };

  const handleRemoveMember = async (member) => {
    if (confirm(`Are you sure you want to remove ${member?.team_members?.full_name} from the team?`)) {
      const updatedMembers = members?.filter(m => m?.id !== member?.id);
      setMembers(updatedMembers);
    }
  };

  const handleViewDetails = (member) => {
    setSelectedMember(member);
    setShowDetailModal(true);
  };

  const handleExportMembers = () => {
    const csvContent = [
      ['Name', 'Email', 'Role', 'Phone', 'Dietary Restrictions', 'Status', 'Joined Date'],
      ...filteredMembers?.map(member => [
        member?.team_members?.full_name || '',
        member?.team_members?.email || '',
        member?.team_members?.role || '',
        member?.team_members?.phone_number || '',
        member?.team_members?.allergies || '',
        member?.team_members?.is_active ? 'Active' : 'Inactive',
        new Date(member?.joined_at)?.toLocaleDateString() || ''
      ])
    ];

    const csv = csvContent?.map(row => row?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `team-members-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    link?.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = async (csvData) => {
    // Process CSV data and add to members
    const newMembers = csvData?.map((row, index) => ({
      id: (Date.now() + index)?.toString(),
      team_members: {
        id: (Date.now() + index)?.toString(),
        full_name: row?.name || row?.Name || '',
        email: row?.email || row?.Email || '',
        phone_number: row?.phone || row?.Phone || '',
        role: (row?.role || row?.Role || 'player')?.toLowerCase(),
        allergies: row?.allergies || row?.['Dietary Restrictions'] || 'None',
        is_active: true
      },
      joined_at: new Date()?.toISOString()
    }));

    setMembers([...members, ...newMembers]);
    setShowCSVModal(false);
  };

  const memberStats = {
    total: members?.length || 0,
    active: members?.filter(m => m?.team_members?.is_active)?.length || 0,
    coaches: members?.filter(m => m?.team_members?.role === 'coach')?.length || 0,
    players: members?.filter(m => m?.team_members?.role === 'player')?.length || 0,
    staff: members?.filter(m => m?.team_members?.role === 'staff')?.length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Team Members</h1>
              <p className="text-muted-foreground">
                Manage your team members, roles, and contact information
              </p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <span>{memberStats?.total} members</span>
                <span>•</span>
                <span>{memberStats?.active} active</span>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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
              >
                Add Member
              </Button>
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
                  <p className="text-muted-foreground text-sm">Active Members</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.active}</p>
                </div>
                <Icon name="UserCheck" size={24} className="text-green-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Coaches</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.coaches}</p>
                </div>
                <Icon name="Trophy" size={24} className="text-amber-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Players</p>
                  <p className="text-2xl font-bold text-foreground">{memberStats?.players}</p>
                </div>
                <Icon name="Users2" size={24} className="text-blue-600" />
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-athletic mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-1 items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                  <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search members by name or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={roleFilter}
                  onChange={(value) => setRoleFilter(value)}
                  options={[
                    { value: 'all', label: 'All Roles' },
                    { value: 'coach', label: 'Coaches' },
                    { value: 'player', label: 'Players' },
                    { value: 'staff', label: 'Staff' },
                  ]}
                />
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
                  onClick={handleExportMembers}
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
      </main>
    </div>
  );
};

export default TeamMembersManagement;