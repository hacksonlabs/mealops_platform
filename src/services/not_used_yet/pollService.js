import { supabase } from '../../lib/supabase';

export const pollService = {
  async getTeamPolls(teamId) {
    try {
      const { data, error } = await supabase?.from('meal_polls')?.select(`
          *,
          user_profiles:created_by (
            full_name
          ),
          poll_options (
            id,
            restaurant_name,
            cuisine_type,
            description,
            poll_votes (
              id,
              user_id
            )
          )
        `)?.eq('team_id', teamId)?.order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get team polls error:', error?.message);
      return { data: [], error };
    }
  },

  async createPoll(pollData) {
    try {
      const user = (await supabase?.auth?.getUser())?.data?.user;
      
      const { data, error } = await supabase?.from('meal_polls')?.insert({
          ...pollData,
          created_by: user?.id,
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Create poll error:', error?.message);
      return { data: null, error };
    }
  },

  async addPollOptions(pollId, options) {
    try {
      const optionsData = options?.map(option => ({
        poll_id: pollId,
        ...option,
      }));

      const { data, error } = await supabase?.from('poll_options')?.insert(optionsData)?.select();

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Add poll options error:', error?.message);
      return { data: [], error };
    }
  },

  async updatePoll(pollId, pollData) {
    try {
      const { data, error } = await supabase?.from('meal_polls')?.update(pollData)?.eq('id', pollId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update poll error:', error?.message);
      return { data: null, error };
    }
  },

  async deletePoll(pollId) {
    try {
      const { error } = await supabase?.from('meal_polls')?.delete()?.eq('id', pollId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete poll error:', error?.message);
      return { error };
    }
  },

  async votePoll(pollId, optionId) {
    try {
      const user = (await supabase?.auth?.getUser())?.data?.user;

      // Remove any existing vote for this poll by this user
      await supabase?.from('poll_votes')?.delete()?.eq('poll_id', pollId)?.eq('user_id', user?.id);

      // Add new vote
      const { data, error } = await supabase?.from('poll_votes')?.insert({
          poll_id: pollId,
          option_id: optionId,
          user_id: user?.id,
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Vote poll error:', error?.message);
      return { data: null, error };
    }
  },

  async getUserVote(pollId) {
    try {
      const user = (await supabase?.auth?.getUser())?.data?.user;

      const { data, error } = await supabase?.from('poll_votes')?.select('option_id')?.eq('poll_id', pollId)?.eq('user_id', user?.id)?.single();

      if (error && error?.code !== 'PGRST116') throw error;
      return { data: data?.option_id || null, error: null };
    } catch (error) {
      console.error('Get user vote error:', error?.message);
      return { data: null, error };
    }
  },

  async getActivePolls(teamId) {
    try {
      const { data, error } = await supabase?.from('meal_polls')?.select(`
          *,
          poll_options (
            id,
            restaurant_name,
            cuisine_type,
            description
          )
        `)?.eq('team_id', teamId)?.eq('poll_status', 'active')?.gt('expires_at', new Date()?.toISOString())?.order('expires_at', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get active polls error:', error?.message);
      return { data: [], error };
    }
  },
};