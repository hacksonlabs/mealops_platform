// src/services/cartDBService.js
import { supabase } from '../lib/supabase';

/**
 * We keep the payload for "who it's for" in selected_options.__assignment__
 * so you don't need to change tables again:
 * {
 *   __assignment__: {
 *     member_ids: [uuid, ...],   // team_members.id
 *     extra_count: number,       // how many "Extra" meals
 *     display_names: [string]    // snapshot for quick rendering in header
 *   },
 *   ...your other option groups...
 * }
 */

async function findActiveCartForRestaurant(teamId, restaurantId) {
  const { data, error } = await supabase
    .from('meal_carts')
    .select('id')
    .eq('team_id', teamId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function ensureCartForRestaurant(teamId, restaurantId, { title = null } = {}) {
  const existingId = await findActiveCartForRestaurant(teamId, restaurantId);
  if (existingId) return existingId;

  const { data: created, error: insErr } = await supabase
    .from('meal_carts')
    .insert({
      team_id: teamId,
      restaurant_id: restaurantId,
      title: title || 'Team Cart',
      status: 'draft'
      // created_by_member_id is auto-validated by trigger; can be NULL
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  return created.id;
}

async function getCartSnapshot(cartId) {
  // cart & its restaurant
  const { data: cart, error: cartErr } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id,
      restaurants ( id, name, image_url ),
      status
    `)
    .eq('id', cartId)
    .maybeSingle();
  if (cartErr) throw cartErr;
  if (!cart) return null;

  // items
  const { data: items, error: itemsErr } = await supabase
    .from('meal_cart_items')
    .select(`
      id, cart_id, menu_item_id, item_name, quantity, price, special_instructions, selected_options, added_by_member_id,
      menu_items ( id, name, image_url )
    `)
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  if (itemsErr) throw itemsErr;

  const mapped = (items || []).map((it) => {
    const sel = it.selected_options || {};
    const assignment = sel.__assignment__ || {};
    const displayNames = assignment.display_names || null;

    return {
      id: it.id, // unique row id (used as React key and for Edit/Remove)
      name: it.item_name || it.menu_items?.name || 'Item',
      quantity: it.quantity || 1,
      price: Number(it.price || 0),
      image: it.menu_items?.image_url || null,
      selectedOptions: sel, // raw JSON you saved (still available for modal)
      specialInstructions: it.special_instructions || '',
      menuItemId: it.menu_item_id || it.menu_items?.id,
      // For the header to show "For: Alice, Bob" (snapshot)
      assignedTo: Array.isArray(displayNames)
        ? displayNames.map((n) => ({ name: n }))
        : [],

      // extra fields you might use
      addedByMemberId: it.added_by_member_id || null,
    };
  });

  return {
    cart: {
      id: cart.id,
      teamId: cart.team_id,
      status: cart.status ?? 'draft',
    },
    restaurant: cart.restaurants
      ? {
          id: cart.restaurants.id,
          name: cart.restaurants.name,
          image: cart.restaurants.image_url,
        }
      : null,
    items: mapped,
  };
}

async function addItem(
  cartId,
  { menuItem, quantity, unitPrice, specialInstructions, selectedOptions, assignment }
) {
  // --- sanitize inputs for JSON + rows ---
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const rawIds = assignment?.memberIds ?? [];
  const memberIdsForJson = rawIds.filter((id) => uuidRe.test(id));
  const inferredExtras = rawIds.filter((id) => id === '__EXTRA__').length;
  const extraCount = Math.max(assignment?.extraCount ?? 0, inferredExtras);

  const selected_options = {
    ...selectedOptions,
    __assignment__: {
      member_ids: memberIdsForJson,
      extra_count: extraCount,
      display_names: assignment?.displayNames || [],
    },
  };

  // create the item
  const { data, error } = await supabase
    .from('meal_cart_items')
    .insert({
      cart_id: cartId,
      menu_item_id: menuItem?.id || null,
      item_name: menuItem?.name || 'Item',
      quantity: Math.max(1, Number(quantity || 1)),
      price: Number(unitPrice || 0),
      special_instructions: specialInstructions || '',
      selected_options,
    })
    .select('id')
    .single();

  if (error) throw error;
  const itemId = data.id;

  // persist assignees (rows)
  const validMemberIds = memberIdsForJson; // already sanitized
  if (validMemberIds.length || extraCount > 0) {
    const rows = [
      ...validMemberIds.map((mid) => ({ cart_item_id: itemId, member_id: mid, is_extra: false })),
      ...Array.from({ length: extraCount }, () => ({ cart_item_id: itemId, is_extra: true })),
    ];
    const { error: asgErr } = await supabase.from('meal_cart_item_assignees').insert(rows);
    if (asgErr) {
      // rollback item if assignees fail (capacity/RLS/etc.)
      await supabase.from('meal_cart_items').delete().eq('id', itemId).eq('cart_id', cartId);
      throw asgErr;
    }
  }

  return itemId;
}

async function updateItem(cartId, itemId, patch) {
  const payload = {
    ...(typeof patch.quantity === 'number' ? { quantity: patch.quantity } : {}),
    ...(typeof patch.price === 'number' ? { price: patch.price } : {}),
    ...(typeof patch.special_instructions === 'string' ? { special_instructions: patch.special_instructions } : {}),
    ...(patch.selected_options !== undefined ? { selected_options: patch.selected_options } : {}),
  };

  const { data, error } = await supabase
    .from('meal_cart_items')
    .update(payload)
    .eq('id', itemId)
    .eq('cart_id', cartId)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function removeItem(cartId, itemId) {
  const { error } = await supabase
    .from('meal_cart_items')
    .delete()
    .eq('id', itemId)
    .eq('cart_id', cartId);

  if (error) throw error;
}

function subscribeToCart(cartId, onChange) {
  // Realtime: refresh when any item changes
  const channel = supabase
    .channel(`cart-${cartId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'meal_cart_items', filter: `cart_id=eq.${cartId}` },
      () => onChange?.()
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

export default {
	findActiveCartForRestaurant,
  ensureCartForRestaurant,
  getCartSnapshot,
  addItem,
  updateItem,
  removeItem,
  subscribeToCart,
};
