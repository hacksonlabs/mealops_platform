import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function useMembers({ teamId, isOpen }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!isOpen || !teamId) { setMembers([]); return; }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('team_members')
          .select('id, full_name, email, role, phone_number')
          .eq('team_id', teamId)
          .order('full_name', { ascending: true });
        if (error) throw error;
        if (!cancel) setMembers(data || []);
      } catch (e) {
        if (!cancel) setMembers([]);
        console.warn('Failed to load team members', e);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [isOpen, teamId]);

  return { members, membersLoading: loading };
}
