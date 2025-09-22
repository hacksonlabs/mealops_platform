// src/pages/team-members-management/index.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const TABS = { MEMBERS: 'members', GROUPS: 'groups' };

/* ---------- Small presentational pieces ---------- */

function PageHeader({ team, teamsCount, onNewTeam, onEditTeam }) {
  const titlePieces = [
    team?.name || 'Team',
    team?.gender ? toTitleCase(team.gender) : '',
    team?.sport || '',
  ].filter(Boolean);

  return (
    <div className="mb-8">
      {/* Mobile layout */}
      <div className="md:hidden space-y-4">
        <div>
          <h1 className="text-3xl font-extrabold text-foreground leading-tight mb-2">
            {titlePieces.join(' ')}
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage members, roles, contact information, and groups for{' '}
            <span className="font-semibold text-foreground">
              {team?.name || 'your team'}
            </span>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {teamsCount > 0 && (
            <Button
              onClick={onNewTeam}
              iconName="Plus"
              iconPosition="left"
              variant="outline"
            >
              New Team
            </Button>
          )}
          {team?.id && (
            <Button
              variant="outline"
              onClick={onEditTeam}
              iconName="Edit"
              iconPosition="left"
            >
              Edit Team
            </Button>
          )}
        </div>

        {team?.conference_name && (
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-gradient-to-br from-purple-500/10 to-purple-700/10 border border-purple-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
              <Icon name="ClipboardList" size={18} className="text-purple-500 flex-shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground">Conference</p>
                <strong className="text-sm text-foreground font-semibold">
                  {team.conference_name}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold text-foreground leading-tight mb-3">
            {titlePieces.join(' ')}
          </h1>
          <p className="text-lg text-muted-foreground mb-4">
            Manage members, roles, contact information, and groups for{' '}
            <span className="font-semibold text-foreground">
              {team?.name || 'your team'}
            </span>.
          </p>

          {team?.conference_name && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
              <div className="bg-gradient-to-br from-purple-500/10 to-purple-700/10 border border-purple-500/20 rounded-lg p-3 flex items-center space-x-3 shadow-md">
                <Icon name="ClipboardList" size={20} className="text-purple-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Conference</p>
                  <strong className="text-base text-foreground font-semibold">
                    {team.conference_name}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {teamsCount > 0 && (
            <Button onClick={onNewTeam} iconName="Plus" iconPosition="left" variant="outline">
              New Team
            </Button>
          )}
          {team?.id && (
            <Button variant="outline" onClick={onEditTeam} iconName="Edit" iconPosition="left">
              Edit Team
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TabsNav({ value, onChange }) {
  const btnBase =
    'pb-3 px-1 border-b-2 text-sm font-medium transition-colors';
  const active = 'border-primary text-foreground';
  const idle = 'border-transparent text-muted-foreground hover:text-foreground';

  return (
    <div className="mb-6 border-b border-border overflow-x-auto">
      <nav className="-mb-px flex min-w-max gap-4 px-1" aria-label="Team sections">
        <button
          type="button"
          onClick={() => onChange(TABS.MEMBERS)}
          className={`${btnBase} ${value === TABS.MEMBERS ? active : idle}`}
        >
          Members
        </button>
        <button
          type="button"
          onClick={() => onChange(TABS.GROUPS)}
          className={`${btnBase} ${value === TABS.GROUPS ? active : idle}`}
        >
          Groups
        </button>
      </nav>
    </div>
  );
}

/* ---------- Container page ---------- */

const TeamMembersManagement = () => {
  const navigate = useNavigate();
  const {
    user,
    teams,
    activeTeam,
    loading: authLoading,
    loadingTeams,
    refreshTeams,
  } = useAuth();

  const [tab, setTab] = useState(TABS.MEMBERS);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const canDelete = useMemo(
    () => Boolean(user?.id && activeTeam?.coach_id === user?.id),
    [user?.id, activeTeam?.coach_id]
  );

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

  const handleCreateTeam = useCallback(() => {
    navigate('/team-setup', {
      state: { next: '/team-members-management', source: 'team-tab' },
    });
  }, [navigate]);

  const handleOpenEdit = useCallback(() => setShowEditTeamModal(true), []);
  const handleCloseEdit = useCallback(() => setShowEditTeamModal(false), []);

  const handleUpdateTeam = useCallback(
    async (updatedTeamData) => {
      if (!activeTeam?.id) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from('teams')
          .update(updatedTeamData)
          .eq('id', activeTeam.id);
        if (error) throw error;
        await refreshTeams();
      } catch (e) {
        console.error('Error updating team information:', e?.message || e);
      } finally {
        setSaving(false);
      }
    },
    [activeTeam?.id, refreshTeams]
  );

  const handleDeleteTeam = useCallback(
    async (team) => {
      try {
        if (!activeTeam?.id) {
          return { success: false, error: 'Missing team id.' };
        }
        const { error: delErr } = await supabase
          .from('teams')
          .delete()
          .eq('id', team.id);
        if (delErr) {
          return {
            success: false,
            error: delErr.message || 'Unable to delete team.',
          };
        }
        await refreshTeams();
        return { success: true };
      } catch (err) {
        return { success: false, error: err?.message || 'Failed to delete team.' };
      }
    },
    [activeTeam?.id, refreshTeams]
  );

  // Light loading shell to avoid layout jump
  const isBootLoading = authLoading || loadingTeams;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          {isBootLoading ? (
            <div className="mb-8">
              <div className="h-9 w-2/3 bg-muted animate-pulse rounded mb-3" />
              <div className="h-5 w-1/2 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <PageHeader
              team={activeTeam}
              teamsCount={teams?.length || 0}
              onNewTeam={handleCreateTeam}
              onEditTeam={handleOpenEdit}
            />
          )}

          {/* Tabs */}
          <TabsNav value={tab} onChange={setTab} />

          {/* Content */}
          {tab === TABS.MEMBERS ? <MembersTab /> : <GroupsTab />}
        </div>
      </main>

      {/* Edit team */}
      {showEditTeamModal && activeTeam && (
        <EditTeamModal
          team={activeTeam}
          canDelete={canDelete}
          onDeleteTeam={handleDeleteTeam}
          onClose={handleCloseEdit}
          onUpdate={handleUpdateTeam}
          loading={saving}
        />
      )}
    </div>
  );
};

export default TeamMembersManagement;
