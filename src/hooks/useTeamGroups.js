import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const EMPTY = [];

const fetchGroupsForTeam = async (teamId) => {
  const { data: groupRows, error: groupErr } = await supabase
    .from('member_groups')
    .select('id, team_id, name, created_at')
    .eq('team_id', teamId)
    .order('name', { ascending: true });
  if (groupErr) throw groupErr;

  const ids = (groupRows || []).map((g) => g.id);
  let membersByGroup = {};
  if (ids.length) {
    const { data: memberRows, error: memberErr } = await supabase
      .from('member_group_members')
      .select('group_id, member_id')
      .in('group_id', ids);
    if (memberErr) throw memberErr;
    membersByGroup = (memberRows || []).reduce((acc, row) => {
      (acc[row.group_id] ||= []).push(row.member_id);
      return acc;
    }, {});
  }

  return (groupRows || []).map((group) => ({
    id: group.id,
    name: group.name || 'Unnamed Group',
    memberIds: Array.from(new Set(membersByGroup[group.id] || EMPTY)),
    memberCount: (membersByGroup[group.id] || EMPTY).length,
  }));
};

export default function useTeamGroups({ teamId, enabled = true }) {
  const [groups, setGroups] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!teamId || !enabled) {
      setGroups(EMPTY);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await fetchGroupsForTeam(teamId);
      setGroups(list);
    } catch (err) {
      console.warn('Failed to load team groups', err);
      setError(err);
      setGroups(EMPTY);
    } finally {
      setLoading(false);
    }
  }, [teamId, enabled]);

  useEffect(() => {
    let cancelled = false;
    if (!teamId || !enabled) {
      setGroups(EMPTY);
      return undefined;
    }
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = await fetchGroupsForTeam(teamId);
        if (!cancelled) setGroups(list);
      } catch (err) {
        if (!cancelled) {
          console.warn('Failed to load team groups', err);
          setError(err);
          setGroups(EMPTY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId, enabled]);

  return {
    groups,
    loading,
    error,
    reload: load,
  };
}
