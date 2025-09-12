import { supabase } from '../lib/supabase';

class SharedCartService {
  // Create a new shared cart
  async createSharedCart(restaurantId, teamId = null) {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase?.from('meal_orders')?.insert({
          title: 'Shared Cart',
          description: 'Collaborative food ordering',
          restaurant_id: restaurantId,
          team_id: teamId,
          created_by: session?.user?.id,
          order_status: 'draft',
          is_shared_cart: true,
          scheduled_date: new Date()?.toISOString()
        })?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating shared cart:', error);
      throw error;
    }
  }

  // Get shared cart by ID with all related data
  async getSharedCart(cartId) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          restaurants(id, name, image_url, rating, cuisine_type, delivery_fee),
          order_items(
            id,
            item_name,
            quantity,
            price,
            selected_options,
            special_instructions,
            created_at,
            menu_items(id, name, image_url, category),
            user_profiles(id, first_name, last_name)
          ),
          shared_cart_sessions(
            id,
            user_id,
            permission,
            joined_at,
            is_active,
            last_activity,
            user_profiles(id, first_name, last_name, email)
          )
        `)?.eq('id', cartId)?.eq('is_shared_cart', true)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching shared cart:', error);
      throw error;
    }
  }

  // Add item to shared cart
  async addItemToCart(cartId, menuItemId, quantity = 1, selectedOptions = {}, specialInstructions = '') {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      // Get menu item details
      const { data: menuItem, error: menuError } = await supabase?.from('menu_items')?.select('name, price')?.eq('id', menuItemId)?.single();

      if (menuError) throw menuError;

      // Calculate price with options
      let totalPrice = menuItem?.price * quantity;
      if (selectedOptions && typeof selectedOptions === 'object') {
        Object.values(selectedOptions)?.forEach(option => {
          if (option?.price) {
            totalPrice += option?.price * quantity;
          }
        });
      }

      // Add item to cart
      const { data, error } = await supabase?.from('order_items')?.insert({
          order_id: cartId,
          menu_item_id: menuItemId,
          user_id: session?.user?.id,
          item_name: menuItem?.name,
          quantity,
          price: totalPrice,
          selected_options: selectedOptions,
          special_instructions: specialInstructions
        })?.select(`
          *,
          menu_items(id, name, image_url),
          user_profiles(id, first_name, last_name)
        `)?.single();

      if (error) throw error;

      // Log activity
      await this.logActivity(cartId, 'item_added', {
        item_name: menuItem?.name,
        quantity,
        price: totalPrice
      });

      return data;
    } catch (error) {
      console.error('Error adding item to cart:', error);
      throw error;
    }
  }

  // Update cart item quantity
  async updateCartItemQuantity(cartId, itemId, newQuantity) {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      if (newQuantity <= 0) {
        return this.removeCartItem(cartId, itemId);
      }

      // Get current item details
      const { data: currentItem } = await supabase?.from('order_items')?.select('item_name, price, quantity, menu_items(price)')?.eq('id', itemId)?.single();

      // Calculate new price (base price per unit * new quantity)
      const unitPrice = currentItem?.menu_items?.price || (currentItem?.price / currentItem?.quantity);
      const newPrice = unitPrice * newQuantity;

      const { data, error } = await supabase?.from('order_items')?.update({ 
          quantity: newQuantity,
          price: newPrice
        })?.eq('id', itemId)?.eq('order_id', cartId)?.select()?.single();

      if (error) throw error;

      // Log activity
      await this.logActivity(cartId, 'item_updated', {
        item_name: currentItem?.item_name,
        old_quantity: currentItem?.quantity,
        new_quantity: newQuantity
      });

      return data;
    } catch (error) {
      console.error('Error updating cart item quantity:', error);
      throw error;
    }
  }

  // Remove item from cart
  async removeCartItem(cartId, itemId) {
    try {
      // Get item details before deletion
      const { data: itemToRemove } = await supabase?.from('order_items')?.select('item_name, quantity')?.eq('id', itemId)?.single();

      const { error } = await supabase?.from('order_items')?.delete()?.eq('id', itemId)?.eq('order_id', cartId);

      if (error) throw error;

      // Log activity
      if (itemToRemove) {
        await this.logActivity(cartId, 'item_removed', {
          item_name: itemToRemove?.item_name,
          quantity: itemToRemove?.quantity
        });
      }

      return true;
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }

  // Get cart totals
  async getCartTotals(cartId) {
    try {
      const { data, error } = await supabase?.from('order_items')?.select('price, quantity')?.eq('order_id', cartId);

      if (error) throw error;

      const subtotal = data?.reduce((sum, item) => sum + (item?.price || 0), 0) || 0;
      
      // Get restaurant delivery fee
      const { data: cartData } = await supabase?.from('meal_orders')?.select('restaurants(delivery_fee)')?.eq('id', cartId)?.single();

      const deliveryFee = cartData?.restaurants?.delivery_fee || 0;
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + deliveryFee + tax;

      return {
        subtotal,
        deliveryFee,
        tax,
        total,
        itemCount: data?.length || 0
      };
    } catch (error) {
      console.error('Error calculating cart totals:', error);
      return { subtotal: 0, deliveryFee: 0, tax: 0, total: 0, itemCount: 0 };
    }
  }

  // Log activity helper
  async logActivity(cartId, activityType, itemDetails = {}) {
    try {
      await supabase?.rpc('log_cart_activity', {
        cart_id: cartId,
        activity_type: activityType,
        item_details: itemDetails
      });
    } catch (error) {
      console.error('Error logging activity:', error);
    }
  }

  // Get cart by share token
  async getCartByShareToken(shareToken) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          restaurants(id, name, image_url, rating, cuisine_type, delivery_fee)
        `)?.eq('share_token', shareToken)?.eq('is_shared_cart', true)?.gte('share_expires_at', new Date()?.toISOString())?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching cart by share token:', error);
      throw error;
    }
  }

  // Update cart permissions
  async updateCartPermission(cartId, userId, permission) {
    try {
      const { data, error } = await supabase?.from('shared_cart_sessions')?.update({ permission })?.eq('meal_order_id', cartId)?.eq('user_id', userId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating cart permission:', error);
      throw error;
    }
  }

  // Get user's shared carts
  async getUserSharedCarts() {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase?.from('meal_orders')?.select(`
          *,
          restaurants(id, name, image_url, cuisine_type),
          order_items(id),
          shared_cart_sessions(
            id,
            user_id,
            permission,
            user_profiles(id, first_name, last_name)
          )
        `)?.eq('is_shared_cart', true)?.or(`created_by.eq.${session?.user?.id},shared_cart_sessions.user_id.eq.${session?.user?.id}`)?.eq('order_status', 'draft')?.order('updated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching user shared carts:', error);
      return [];
    }
  }

  // Convert cart to order
  async convertCartToOrder(cartId, deliveryInfo = {}) {
    try {
      const { data, error } = await supabase?.from('meal_orders')?.update({
          order_status: 'pending_confirmation',
          is_shared_cart: false,
          share_token: null,
          share_expires_at: null,
          ...deliveryInfo
        })?.eq('id', cartId)?.select()?.single();

      if (error) throw error;

      // Deactivate all sessions
      await supabase?.from('shared_cart_sessions')?.update({ is_active: false })?.eq('meal_order_id', cartId);

      return data;
    } catch (error) {
      console.error('Error converting cart to order:', error);
      throw error;
    }
  }
}

export default new SharedCartService();