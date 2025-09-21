import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const SharedCartContext = createContext({});

export const useSharedCart = () => {
  const context = useContext(SharedCartContext);
  if (!context) {
    throw new Error('useSharedCart must be used within SharedCartProvider');
  }
  return context;
};

export const SharedCartProvider = ({ children }) => {
  const { user } = useAuth();
  const [activeCartId, setActiveCartId] = useState(null);
  const [cartSessions, setCartSessions] = useState([]);
  const [cartActivities, setCartActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get current active shared cart
  const getActiveSharedCart = async () => {
    if (!user?.id) return null;

    try {
      setLoading(true);
      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          shared_cart_sessions(
            id,
            user_id,
            permission,
            joined_at,
            is_active,
            user_profiles(id, first_name, last_name)
          )
        `)?.eq('order_status', 'draft')?.eq('is_shared_cart', true)?.or(`created_by.eq.${user?.id},shared_cart_sessions.user_id.eq.${user?.id}`)?.order('updated_at', { ascending: false })?.limit(1)?.single();

      if (error && error?.code !== 'PGRST116') {
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error fetching active shared cart:', error);
      setError('Failed to load active shared cart');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Generate shareable link
  const generateShareableLink = async (cartId, expiresHours = 24) => {
    try {
      const { data, error } = await supabase?.rpc('generate_cart_share_token', {
          cart_id: cartId,
          expires_hours: expiresHours
        });

      if (error) throw error;

      const shareUrl = `${window.location?.origin}/shared-cart/${data}`;
      return { shareToken: data, shareUrl };
    } catch (error) {
      console.error('Error generating share link:', error);
      setError('Failed to generate share link');
      throw error;
    }
  };

  // Join shared cart via token
  const joinSharedCart = async (shareToken) => {
    try {
      setLoading(true);
      const { data, error } = await supabase?.rpc('join_shared_cart', { share_token: shareToken });

      if (error) throw error;

      setActiveCartId(data);
      
      // Refresh cart data
      await loadCartSessions(data);
      
      return data;
    } catch (error) {
      console.error('Error joining shared cart:', error);
      setError('Failed to join shared cart. The link may be invalid or expired.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Load cart sessions
  const loadCartSessions = async (cartId) => {
    if (!cartId) return;

    try {
      const { data, error } = await supabase?.from('shared_cart_sessions')?.select(`
          *,
          user_profiles(id, first_name, last_name, email)
        `)?.eq('meal_order_id', cartId)?.eq('is_active', true)?.order('joined_at', { ascending: true });

      if (error) throw error;

      setCartSessions(data || []);
    } catch (error) {
      console.error('Error loading cart sessions:', error);
    }
  };

  // Load cart activities
  const loadCartActivities = async (cartId, limit = 20) => {
    if (!cartId) return;

    try {
      const { data, error } = await supabase?.from('cart_activities')?.select(`
          *,
          user_profiles(id, first_name, last_name)
        `)?.eq('meal_order_id', cartId)?.order('created_at', { ascending: false })?.limit(limit);

      if (error) throw error;

      setCartActivities(data || []);
    } catch (error) {
      console.error('Error loading cart activities:', error);
    }
  };

  // Log cart activity
  const logCartActivity = async (cartId, activityType, itemDetails = {}) => {
    try {
      await supabase?.rpc('log_cart_activity', {
        cart_id: cartId,
        activity_type: activityType,
        item_details: itemDetails
      });
    } catch (error) {
      console.error('Error logging cart activity:', error);
    }
  };

  // Leave shared cart
  const leaveSharedCart = async (cartId) => {
    try {
      // Deactivate session
      await supabase?.from('shared_cart_sessions')?.update({ is_active: false })?.eq('meal_order_id', cartId)?.eq('user_id', user?.id);

      // Log activity
      await logCartActivity(cartId, 'user_left');

      // Clear local state
      if (activeCartId === cartId) {
        setActiveCartId(null);
        setCartSessions([]);
        setCartActivities([]);
      }
    } catch (error) {
      console.error('Error leaving shared cart:', error);
      setError('Failed to leave shared cart');
    }
  };

  // Copy share link to clipboard
  const copyShareLink = async (shareUrl) => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  };

  // Real-time subscriptions
  useEffect(() => {
    if (!activeCartId || !user?.id) return;

    // Subscribe to cart activities
    const activitiesChannel = supabase?.channel(`cart-activities-${activeCartId}`)?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cart_activities',
          filter: `meal_order_id=eq.${activeCartId}`
        },
        (payload) => {
          if (payload?.eventType === 'INSERT') {
            setCartActivities(prev => [payload?.new, ...prev?.slice(0, 19)]);
          }
        }
      )?.subscribe();

    // Subscribe to cart sessions
    const sessionsChannel = supabase?.channel(`cart-sessions-${activeCartId}`)?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_cart_sessions',
          filter: `meal_order_id=eq.${activeCartId}`
        },
        () => {
          // Reload sessions when changes occur
          loadCartSessions(activeCartId);
        }
      )?.subscribe();

    // Subscribe to order items changes
    const orderItemsChannel = supabase?.channel(`order-items-${activeCartId}`)?.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `order_id=eq.${activeCartId}`
        },
        (payload) => {
          // Emit custom event for cart updates
          const event = new CustomEvent('cartItemsChanged', {
            detail: { payload, cartId: activeCartId }
          });
          window.dispatchEvent(event);
        }
      )?.subscribe();

    return () => {
      supabase?.removeChannel(activitiesChannel);
      supabase?.removeChannel(sessionsChannel);
      supabase?.removeChannel(orderItemsChannel);
    };
  }, [activeCartId, user?.id]);

  // Clear error after a timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const value = {
    activeCartId,
    cartSessions,
    cartActivities,
    loading,
    error,
    setActiveCartId,
    getActiveSharedCart,
    generateShareableLink,
    joinSharedCart,
    loadCartSessions,
    loadCartActivities,
    logCartActivity,
    leaveSharedCart,
    copyShareLink,
    setError
  };

  return (
    <SharedCartContext.Provider value={value}>
      {children}
    </SharedCartContext.Provider>
  );
};

export default SharedCartProvider;