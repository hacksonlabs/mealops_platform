import { supabase } from '../../lib/supabase';

// Helper function to validate session
const validateSession = async () => {
  try {
    // First try to get the current session
    const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
    
    if (sessionError) {
      throw new Error(`Session error: ${sessionError.message}`);
    }
    
    if (!session?.user?.id) {
      throw new Error('Auth session missing!');
    }
    
    // Double check with getUser for extra validation
    const { data: { user }, error: userError } = await supabase?.auth?.getUser();
    
    if (userError || !user?.id) {
      throw new Error('User authentication failed!');
    }
    
    return { user, session, error: null };
  } catch (error) {
    console.error('Session validation error:', error?.message);
    return { user: null, session: null, error };
  }
};

export const teamService = {
  async getUserTeam() {
    try {
      // Validate session before making any requests
      const { user, error: validationError } = await validateSession();
      
      if (validationError || !user?.id) {
        throw validationError || new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('team_members')?.select(`
          team_id,
          teams:team_id (
            id,
            name,
            sport,
            season,
            coach_id,
            user_profiles:coach_id (
              full_name,
              email
            )
          )
        `)?.eq('user_id', user?.id)?.single();

      if (error) {
        // Handle specific error cases
        if (error?.code === 'PGRST116') {
          // No rows returned - user not in any team
          return { data: null, error: null };
        }
        throw error;
      }

      return { data: data?.teams, error: null };
    } catch (error) {
      console.error('Get user team error:', error?.message);
      return { data: null, error };
    }
  },

  async getUserTeams(userId = null) {
    try {
      // Validate session before making any requests
      const { user, error: validationError } = await validateSession();
      
      if (validationError || !user?.id) {
        throw validationError || new Error('Authentication required');
      }

      // Use provided userId or current user's id
      const targetUserId = userId || user?.id;

      const { data, error } = await supabase?.from('team_members')?.select(`
          team_id,
          joined_at,
          teams:team_id (
            id,
            name,
            sport,
            season,
            coach_id,
            created_at,
            user_profiles:coach_id (
              full_name,
              email
            )
          )
        `)?.eq('user_id', targetUserId)?.order('joined_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Transform the data to return just the teams array
      const teams = data?.map(item => item?.teams)?.filter(Boolean) || [];
      return { data: teams, error: null };
    } catch (error) {
      console.error('Get user teams error:', error?.message);
      return { data: [], error };
    }
  },

  async createTeam(teamData) {
    try {
      // Validate session before making any requests
      const { user, error: validationError } = await validateSession();
      
      if (validationError || !user?.id) {
        throw validationError || new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('teams')?.insert({
          ...teamData,
          coach_id: user?.id,
        })?.select()?.single();

      if (error) throw error;

      // Add coach to team members
      const { error: memberError } = await supabase?.from('team_members')?.insert({
          team_id: data?.id,
          user_id: user?.id,
        });

      if (memberError) {
        console.error('Failed to add coach to team members:', memberError?.message);
        // Don't throw here as team was created successfully
      }

      return { data, error: null };
    } catch (error) {
      console.error('Create team error:', error?.message);
      return { data: null, error };
    }
  },

  async getTeamMembers(teamId) {
    try {
      // Validate session before making any requests
      const { error: validationError } = await validateSession();
      
      if (validationError) {
        throw validationError;
      }

      if (!teamId) {
        throw new Error('Team ID is required');
      }

      const { data, error } = await supabase?.from('team_members')?.select(`
          id,
          joined_at,
          user_profiles:user_id (
            id,
            full_name,
            email,
            phone,
            role,
            allergies
          )
        `)?.eq('team_id', teamId)?.order('joined_at', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get team members error:', error?.message);
      return { data: [], error };
    }
  },

  async addTeamMember(teamId, userEmail) {
    try {
      // Validate session before making any requests
      const { error: validationError } = await validateSession();
      
      if (validationError) {
        throw validationError;
      }

      // Validate required parameters
      if (!teamId) {
        throw new Error('Team ID is required');
      }
      
      if (!userEmail) {
        throw new Error('User email is required');
      }

      // First, find user by email
      const { data: userData, error: userError } = await supabase?.from('user_profiles')?.select('id')?.eq('email', userEmail?.trim())?.single();

      if (userError || !userData) {
        throw new Error('User not found with that email address');
      }

      // Check if user is already a member
      const { data: existingMember, error: checkError } = await supabase?.from('team_members')?.select('id')?.eq('team_id', teamId)?.eq('user_id', userData?.id)?.single();

      if (checkError && checkError?.code !== 'PGRST116') {
        throw checkError;
      }

      if (existingMember) {
        throw new Error('User is already a member of this team');
      }

      // Add to team
      const { data, error } = await supabase?.from('team_members')?.insert({
          team_id: teamId,
          user_id: userData?.id,
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Add team member error:', error?.message);
      return { data: null, error };
    }
  },

  async removeTeamMember(teamId, userId) {
    try {
      // Validate session before making any requests
      const { error: validationError } = await validateSession();
      
      if (validationError) {
        throw validationError;
      }

      // Validate required parameters
      if (!teamId) {
        throw new Error('Team ID is required');
      }
      
      if (!userId) {
        throw new Error('User ID is required');
      }

      const { error } = await supabase?.from('team_members')?.delete()?.eq('team_id', teamId)?.eq('user_id', userId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Remove team member error:', error?.message);
      return { error };
    }
  },

  async updateUserProfile(profileData) {
    try {
      // Validate session before making any requests
      const { user, error: validationError } = await validateSession();
      
      if (validationError || !user?.id) {
        throw validationError || new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('user_profiles')?.update(profileData)?.eq('id', user?.id)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update user profile error:', error?.message);
      return { data: null, error };
    }
  },
};