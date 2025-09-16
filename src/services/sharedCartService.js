import { supabase } from '../lib/supabase';

class SharedCartService {
  // Create a new shared cart
  async createSharedCart(restaurantId, teamId = null) {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('meal_orders')
        .insert({
          title: 'Shared Cart',
          description: 'Collaborative food ordering',
          restaurant_id: restaurantId,
          team_id: teamId,
          created_by: session?.user?.id,
          order_status: 'draft',
          is_shared_cart: true,
          scheduled_date: new Date()?.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating shared cart:', error);
      throw error;
    }
  }

  // Get shared cart by ID with related data (normalized items)
  async getSharedCart(cartId) {
    try {
      const { data, error } = await supabase
        .from('meal_orders')
        .select(`
          *,
          restaurants(id, name, image_url, rating, cuisine_type, delivery_fee, address, phone_number),
          meal_items:meal_order_items(
            id,
            name,
            description,
            image_url,
            quantity,
            product_marked_price_cents,
            notes,
            created_at
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
        `)
        .eq('id', cartId)
        .eq('is_shared_cart', true)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching shared cart:', error);
      throw error;
    }
  }

  // Add item to shared cart -> meal_order_items
  async addItemToCart(cartId, menuItemId, quantity = 1, selectedOptions = {}, specialInstructions = '') {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      // Pull menu item details
      const { data: menuItem, error: menuError } = await supabase
        .from('menu_items')
        .select('id, api_id, name, description, image_url, price')
        .eq('id', menuItemId)
        .single();
      if (menuError) throw menuError;

      // Calculate *unit* price (cents). Options are flattened into notes for now.
      let optionsExtra = 0;
      const optionList = Array.isArray(selectedOptions)
        ? selectedOptions
        : Object.values(selectedOptions || {});
      for (const opt of optionList) {
        const p = typeof opt === 'object' ? opt?.price : 0;
        if (typeof p === 'number' && !Number.isNaN(p)) optionsExtra += p;
      }
      const unitPriceCents = Math.round((menuItem?.price + optionsExtra) * 100);
      const combinedNotes = [specialInstructions, optionList.map(o => (typeof o === 'object' ? o?.name : String(o))).filter(Boolean).join(', ')].filter(Boolean).join(' | ');

      const { data, error } = await supabase
        .from('meal_order_items')
        .insert({
          order_id: cartId,
          product_id: menuItem?.api_id, // normalized to external/menu API id
          name: menuItem?.name,
          description: menuItem?.description || null,
          image_url: menuItem?.image_url || null,
          notes: combinedNotes || null,
          quantity,
          product_marked_price_cents: unitPriceCents
        })
        .select()
        .single();

      if (error) throw error;

      await this.logActivity(cartId, 'item_added', {
        item_name: menuItem?.name,
        quantity,
        unit_price_cents: unitPriceCents
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

      const { data: currentItem } = await supabase
        .from('meal_order_items')
        .select('name, quantity')
        .eq('id', itemId)
        .single();

      const { data, error } = await supabase
        .from('meal_order_items')
        .update({ quantity: newQuantity })
        .eq('id', itemId)
        .eq('order_id', cartId)
        .select()
        .single();

      if (error) throw error;

      await this.logActivity(cartId, 'item_updated', {
        item_name: currentItem?.name,
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
      const { data: itemToRemove } = await supabase
        .from('meal_order_items')
        .select('name, quantity')
        .eq('id', itemId)
        .single();

      const { error } = await supabase
        .from('meal_order_items')
        .delete()
        .eq('id', itemId)
        .eq('order_id', cartId);

      if (error) throw error;

      if (itemToRemove) {
        await this.logActivity(cartId, 'item_removed', {
          item_name: itemToRemove?.name,
          quantity: itemToRemove?.quantity
        });
      }

      return true;
    } catch (error) {
      console.error('Error removing cart item:', error);
      throw error;
    }
  }

  // Get cart totals (sum normalized items)
  async getCartTotals(cartId) {
    try {
      const { data: items, error: itemsErr } = await supabase
        .from('meal_order_items')
        .select('product_marked_price_cents, quantity')
        .eq('order_id', cartId);

      if (itemsErr) throw itemsErr;

      const subtotalCents =
        (items || []).reduce(
          (sum, it) => sum + (it?.product_marked_price_cents ?? 0) * (it?.quantity ?? 1),
          0
        ) || 0;

      const { data: cartData } = await supabase
        .from('meal_orders')
        .select('restaurants(delivery_fee)')
        .eq('id', cartId)
        .single();

      const deliveryFee = cartData?.restaurants?.delivery_fee || 0;
      const subtotal = subtotalCents / 100;
      const tax = subtotal * 0.08; // 8% tax
      const total = subtotal + deliveryFee + tax;

      const itemCount = (items || []).reduce((sum, it) => sum + (it?.quantity ?? 1), 0);

      return { subtotal, deliveryFee, tax, total, itemCount };
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
      const { data, error } = await supabase
        .from('meal_orders')
        .select(`
          *,
          restaurants(id, name, image_url, rating, cuisine_type, delivery_fee)
        `)
        .eq('share_token', shareToken)
        .eq('is_shared_cart', true)
        .gte('share_expires_at', new Date()?.toISOString())
        .single();

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
      const { data, error } = await supabase
        .from('shared_cart_sessions')
        .update({ permission })
        .eq('meal_order_id', cartId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating cart permission:', error);
      throw error;
    }
  }

  // Get user's shared carts (normalized)
  async getUserSharedCarts() {
    try {
      const { data: { session } } = await supabase?.auth?.getSession();
      if (!session?.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('meal_orders')
        .select(`
          *,
          restaurants(id, name, image_url, cuisine_type),
          meal_order_items(id),
          shared_cart_sessions(
            id,
            user_id,
            permission,
            user_profiles(id, first_name, last_name)
          )
        `)
        .eq('is_shared_cart', true)
        .or(`created_by.eq.${session?.user?.id},shared_cart_sessions.user_id.eq.${session?.user?.id}`)
        .eq('order_status', 'draft')
        .order('updated_at', { ascending: false });

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
      const { data, error } = await supabase
        .from('meal_orders')
        .update({
          order_status: 'pending_confirmation',
          is_shared_cart: false,
          share_token: null,
          share_expires_at: null,
          ...deliveryInfo
        })
        .eq('id', cartId)
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('shared_cart_sessions')
        .update({ is_active: false })
        .eq('meal_order_id', cartId);

      return data;
    } catch (error) {
      console.error('Error converting cart to order:', error);
      throw error;
    }
  }
}

export default new SharedCartService();