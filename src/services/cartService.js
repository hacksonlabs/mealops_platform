// cartService.js
import { supabase } from '../lib/supabase';

export async function updateCartItemDetails(cartId, orderItemId, patch) {
  // patch: { quantity, selected_options, special_instructions, price }
  const payload = {
    ...(typeof patch.quantity === 'number' ? { quantity: patch.quantity } : {}),
    ...(patch.selected_options !== undefined ? { selected_options: patch.selected_options } : {}),
    ...(typeof patch.special_instructions === 'string' ? { special_instructions: patch.special_instructions } : {}),
    ...(typeof patch.price === 'number' ? { price: patch.price } : {}),
  };

  const { data, error } = await supabase
    .from('order_items')
    .update(payload)
    .eq('id', orderItemId)
    .eq('cart_id', cartId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

const cartService = { updateCartItemDetails };
export default cartService;