import { supabase } from '../lib/supabase';

export const orderService = {
  async getTeamOrders(teamId) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          restaurants:restaurant_id (
            name,
            cuisine_type
          ),
          saved_locations:location_id (
            name,
            address
          ),
          user_profiles:created_by (
            full_name
          ),
          order_items (
            id,
            item_name,
            quantity,
            price,
            special_instructions,
            user_profiles:user_id (
              full_name
            )
          )
        `)?.eq('team_id', teamId)?.order('scheduled_date', { ascending: false });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get team orders error:', error?.message);
      return { data: [], error };
    }
  },

  async createOrder(orderData) {
    try {
      const user = (await supabase?.auth?.getUser())?.data?.user;
      
      const { data, error } = await supabase?.from('meal_orders')?.insert({
          ...orderData,
          created_by: user?.id,
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Create order error:', error?.message);
      return { data: null, error };
    }
  },

  async updateOrder(orderId, orderData) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.update({
          ...orderData,
          updated_at: new Date()?.toISOString(),
        })?.eq('id', orderId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update order error:', error?.message);
      return { data: null, error };
    }
  },

  async deleteOrder(orderId) {
    try {
      const { error } = await supabase?.from('meal_orders')?.delete()?.eq('id', orderId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete order error:', error?.message);
      return { error };
    }
  },

  async addOrderItem(orderItem) {
    try {
      const user = (await supabase?.auth?.getUser())?.data?.user;
      
      const { data, error } = await supabase?.from('order_items')?.insert({
          ...orderItem,
          user_id: user?.id,
        })?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Add order item error:', error?.message);
      return { data: null, error };
    }
  },

  async updateOrderItem(itemId, itemData) {
    try {
      const { data, error } = await supabase?.from('order_items')?.update(itemData)?.eq('id', itemId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update order item error:', error?.message);
      return { data: null, error };
    }
  },

  async deleteOrderItem(itemId) {
    try {
      const { error } = await supabase?.from('order_items')?.delete()?.eq('id', itemId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete order item error:', error?.message);
      return { error };
    }
  },

  async getUpcomingOrders(teamId, limit = 5) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          restaurants:restaurant_id (name),
          saved_locations:location_id (name)
        `)?.eq('team_id', teamId)?.gte('scheduled_date', new Date()?.toISOString())?.order('scheduled_date', { ascending: true })?.limit(limit);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get upcoming orders error:', error?.message);
      return { data: [], error };
    }
  },
};