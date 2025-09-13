// src/services/paymentService.js
import { supabase } from '../lib/supabase';

const handleServiceError = (error, operation) => {
  console.error(`Payment Service - ${operation} error:`, error);
  if (error?.code === 'PGRST116') return { data: [], error: null };
  if (error?.code === '42501')
    return { data: null, error: { message: 'Access denied. Please check your team membership.', code: 'ACCESS_DENIED' } };
  if (error?.message?.includes('JWT'))
    return { data: null, error: { message: 'Authentication expired. Please refresh the page.', code: 'AUTH_EXPIRED' } };
  return { data: null, error: { message: error?.message || `Failed to ${operation}`, code: 'UNKNOWN' } };
};

// Reuse the same SELECT everywhere; no `full_name`, use first/last instead.
const baseSelect = `
  id, team_id, card_name, last_four, is_default, created_by, created_at,
  created_by_profile:user_profiles!created_by(id, first_name, last_name, email),
  team:teams(name, sport)
`;

export const PROVIDER_CONFIG = {
  internal: { paymentMode: 'self_hosted' },        // tokenize (Stripe etc) later
  mealme:   { paymentMode: 'external_redirect' },  // MealMe handles payment
  doordash: { paymentMode: 'external_redirect' },
  ubereats: { paymentMode: 'external_redirect' },
  grubhub: { paymentMode: 'external_redirect' },
  ezcater: { paymentMode: 'external_redirect' },
};

export const paymentService = {
  async getPaymentMethods(teamId = null) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      let query = supabase
        .from('payment_methods')
        .select(baseSelect)
        .order('created_at', { ascending: false });

      if (teamId) query = query.eq('team_id', teamId);

      const { data, error } = await query;
      if (error) return handleServiceError(error, 'fetch payment methods');
      return { data: data || [], error: null };
    } catch (error) {
      return handleServiceError(error, 'fetch payment methods');
    }
  },

  async createPaymentMethod(paymentData) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .insert([paymentData])
        .select(baseSelect)
        .single();

      if (error) return handleServiceError(error, 'create payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'create payment method');
    }
  },

  async updatePaymentMethod(id, updates) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .update(updates)
        .eq('id', id)
        .select(baseSelect)
        .single();

      if (error) return handleServiceError(error, 'update payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'update payment method');
    }
  },

  async deletePaymentMethod(id) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) return handleServiceError(error, 'delete payment method');
      return { error: null };
    } catch (error) {
      return handleServiceError(error, 'delete payment method');
    }
  },

  async setDefaultPaymentMethod(id, teamId) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      // unset all defaults for team
      await supabase.from('payment_methods').update({ is_default: false }).eq('team_id', teamId);

      // set selected default
      const { data, error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id)
        .select(baseSelect)
        .single();

      if (error) return handleServiceError(error, 'set default payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'set default payment method');
    }
  },

  async getTeamPaymentMethods(teamId) {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .select(baseSelect)
        .eq('team_id', teamId)
        .order('is_default', { ascending: false });

      if (error) return handleServiceError(error, 'fetch team payment methods');
      return { data: data || [], error: null };
    } catch (error) {
      return handleServiceError(error, 'fetch team payment methods');
    }
  }
};