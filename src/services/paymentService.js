import { supabase } from '../lib/supabase';

// Enhanced error handling for payment service
const handleServiceError = (error, operation) => {
  console.error(`Payment Service - ${operation} error:`, error);
  
  // Enhanced error categorization
  if (error?.code === 'PGRST116') {
    return { data: [], error: null }; // No rows found - return empty array
  }
  
  if (error?.code === '42501') {
    return { data: null, error: { message: 'Access denied. Please check your team membership.', code: 'ACCESS_DENIED' } };
  }
  
  if (error?.message?.includes('JWT')) {
    return { data: null, error: { message: 'Authentication expired. Please refresh the page.', code: 'AUTH_EXPIRED' } };
  }
  
  return { data: null, error: { message: error?.message || `Failed to ${operation}`, code: 'UNKNOWN' } };
};

export const paymentService = {
  async getPaymentMethods(teamId = null) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      let query = supabase?.from('payment_methods')?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name, email),
          team:teams(name, sport)
        `)?.order('created_at', { ascending: false });

      if (teamId) {
        query = query?.eq('team_id', teamId);
      }

      const { data, error } = await query;
      
      if (error) {
        return handleServiceError(error, 'fetch payment methods');
      }

      return { data: data || [], error: null };
    } catch (error) {
      return handleServiceError(error, 'fetch payment methods');
    }
  },

  async createPaymentMethod(paymentData) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('payment_methods')?.insert([paymentData])?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name, email),
          team:teams(name, sport)
        `);

      if (error) {
        return handleServiceError(error, 'create payment method');
      }
      
      return { data: data?.[0], error: null };
    } catch (error) {
      return handleServiceError(error, 'create payment method');
    }
  },

  async updatePaymentMethod(id, updates) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('payment_methods')?.update(updates)?.eq('id', id)?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name, email),
          team:teams(name, sport)
        `);

      if (error) {
        return handleServiceError(error, 'update payment method');
      }
      
      return { data: data?.[0], error: null };
    } catch (error) {
      return handleServiceError(error, 'update payment method');
    }
  },

  async deletePaymentMethod(id) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      const { error } = await supabase?.from('payment_methods')?.delete()?.eq('id', id);

      if (error) {
        return handleServiceError(error, 'delete payment method');
      }
      
      return { error: null };
    } catch (error) {
      return handleServiceError(error, 'delete payment method');
    }
  },

  async setDefaultPaymentMethod(id, teamId) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      // First, unset all defaults for the team
      await supabase?.from('payment_methods')?.update({ is_default: false })?.eq('team_id', teamId);

      // Then set the selected one as default
      const { data, error } = await supabase?.from('payment_methods')?.update({ is_default: true })?.eq('id', id)?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name, email),
          team:teams(name, sport)
        `);

      if (error) {
        return handleServiceError(error, 'set default payment method');
      }
      
      return { data: data?.[0], error: null };
    } catch (error) {
      return handleServiceError(error, 'set default payment method');
    }
  },

  async getTeamPaymentMethods(teamId) {
    try {
      // First validate the session
      const { data: { session }, error: sessionError } = await supabase?.auth?.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required');
      }

      const { data, error } = await supabase?.from('payment_methods')?.select(`
          *,
          created_by_profile:user_profiles!created_by(full_name, email),
          team:teams(name, sport)
        `)?.eq('team_id', teamId)?.order('is_default', { ascending: false });

      if (error) {
        return handleServiceError(error, 'fetch team payment methods');
      }
      
      return { data: data || [], error: null };
    } catch (error) {
      return handleServiceError(error, 'fetch team payment methods');
    }
  }
};