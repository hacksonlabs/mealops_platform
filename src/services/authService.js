import { supabase } from '../lib/supabase';

export const authService = {
  async signIn(email, password) {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error?.message);
      return { data: null, error };
    }
  },

  async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase?.auth?.signUp({
        email,
        password,
        options: {
          data: userData,
        },
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error?.message);
      return { data: null, error };
    }
  },

  async signOut() {
    try {
      const { error } = await supabase?.auth?.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error?.message);
      return { error };
    }
  },

  async resetPassword(email) {
    try {
      const { data, error } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: `${window.location?.origin}/reset-password`,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Reset password error:', error?.message);
      return { data: null, error };
    }
  },

  async updatePassword(newPassword) {
    try {
      const { data, error } = await supabase?.auth?.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update password error:', error?.message);
      return { data: null, error };
    }
  },

  async getCurrentUser() {
    try {
      const {
        data: { user },
        error,
      } = await supabase?.auth?.getUser();

      if (error) throw error;
      return { user, error: null };
    } catch (error) {
      console.error('Get current user error:', error?.message);
      return { user: null, error };
    }
  },
};