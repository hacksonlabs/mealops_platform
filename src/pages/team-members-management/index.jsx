import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts';
import { toTitleCase } from '../../utils/stringUtils';
import Button from '../../components/ui/custom/Button';

import MembersTab from './components/MembersTab';
import GroupsTab from './components/GroupsTab';
import { supabase } from '../../lib/supabase';
import EditTeamModal from './components/EditTeamModal';

const TeamMembersManagement = () => {
  const navigate = useNavigate();
  const { userProfile, teams, activeTeam, loading: authLoading, loadingTeams, user, refreshTeams } = useAuth();
  const [tab, setTab] = useState('members'); // 'members' | 'groups'
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const canDelete = Boolean(user?.id && activeTeam?.coach_id === user?.id);

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

  const handleCreateTeam = () =>
    navigate('/team-setup', {
      state: { next: '/team-members-management', source: 'team-tab' },
    });

  const handleUpdateTeam = useCallback(
    async (updatedTeamData) => {
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
    },
    [activeTeam?.id, refreshTeams]
  );

  const handleDeleteTeam = async (team) => {
    try {
      if (!activeTeam?.id) {
        return { success: false, error: 'Missing team id.' };
      }
      // Delete the team (RLS allows only the coach to do this)
      const { error: delErr } = await supabase.from('teams').delete().eq('id', team.id);
      if (delErr) {
        return { success: false, error: delErr.message || 'Unable to delete team.' };
      }
      await refreshTeams();
      return { success: true };
    } catch (err) {
      return { success: false, error: err?.message || 'Failed to delete team.' };
    }
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex-1">
              <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3">
                {activeTeam?.name || 'Team'} {toTitleCase(activeTeam?.gender) || ''} {activeTeam?.sport || ''}
              </h1>
              <p className="text-lg text-muted-foreground mb-4">
                Manage members, roles, contact information, and groups for{' '}
                <span className="font-semibold text-foreground">{activeTeam?.name || 'your team'}</span>.
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
            <div className="flex items-center justify-end gap-2">
              {teams?.length > 0 && (
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

          {/* Tabs */}
          <div className="mb-6 border-b border-border">
            <nav className="-mb-px flex space-x-6">
              <button
                onClick={() => setTab('members')}
                className={`pb-3 px-1 border-b-2 text-sm font-medium ${
                  tab === 'members'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Members
              </button>
              <button
                onClick={() => setTab('groups')}
                className={`pb-3 px-1 border-b-2 text-sm font-medium ${
                  tab === 'groups'
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Groups
              </button>
            </nav>
          </div>

          {tab === 'members' ? <MembersTab /> : <GroupsTab />}
        </div>
      </main>
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
  );
};

export default TeamMembersManagement;