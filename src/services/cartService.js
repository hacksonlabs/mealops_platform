// cartService.js
import { supabase } from '../lib/supabase';

// We now mutate rows in meal_order_items (normalized snapshot).
// - quantity -> quantity
// - special_instructions -> notes
// - price (decimal) -> product_marked_price_cents (integer cents)
// - selected_options: not persisted here (use customizations/options if/when needed)

export async function updateCartItemDetails(cartId, orderItemId, patch) {
  const payload = {
    ...(typeof patch.quantity === 'number' ? { quantity: patch.quantity } : {}),
    ...(typeof patch.special_instructions === 'string' ? { notes: patch.special_instructions } : {}),
    ...(typeof patch.price === 'number'
      ? { product_marked_price_cents: Math.round(patch.price * 100) }
      : {}),
  };

  const { data, error } = await supabase
    .from('meal_order_items')
    .update(payload)
    .eq('id', orderItemId)
    .eq('order_id', cartId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

const cartService = { updateCartItemDetails };
export default cartService;