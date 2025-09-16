// src/services/cartDBService.js
import { supabase } from '../lib/supabase';
import { toTitleCase } from '../utils/stringUtils';
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

async function findActiveCartForRestaurant(teamId, restaurantId, providerType = null) {
  let q = supabase
    .from('meal_carts')
    .select('id')
    .eq('team_id', teamId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1);
  if (providerType != null) q = q.eq('provider_type', providerType);
  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}


const normalizeTitle = (t) => {
  const s = (t ?? '').trim();
  if (!s) return 'Team Cart';
  return toTitleCase(s);
};

async function ensureCartForRestaurant(teamId, restaurantId, { title, providerType = null, providerRestaurantId = null } = {}) {
  const existingId = await findActiveCartForRestaurant(teamId, restaurantId, providerType);
  if (existingId) return existingId;

  const cleanTitle = normalizeTitle(title);
  const { data: created, error: insErr } = await supabase
    .from('meal_carts')
    .insert({
      team_id: teamId,
      restaurant_id: restaurantId,
      status: 'draft',
      title: cleanTitle,
			provider_type: providerType,
      provider_restaurant_id: providerRestaurantId,
      // created_by_member_id is auto-validated by trigger; can be NULL
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  return created.id;
}


export async function updateCartTitle(cartId, title) {
  const { error } = await supabase.from('meal_carts').update({ title }).eq('id', cartId);
  if (error) throw error;
}


async function getCartSnapshot(cartId) {
  // cart & its restaurant
  const { data: cart, error: cartErr } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id, provider_type, provider_restaurant_id, title,
      restaurants ( id, name, image_url, address, phone_number, rating ),
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
      title: cart.title ?? cart.restaurants.name ?? null,
    },
    restaurant: cart.restaurants
      ? {
          id: cart.restaurants.id,
          name: cart.restaurants.name,
          image: cart.restaurants.image_url,
					address: cart.restaurants.address || null,
          phone: cart.restaurants.phone_number || null,
					rating: cart.restaurants.rating ?? null,
					providerType: cart.provider_type,
          providerRestaurantId: cart.provider_restaurant_id,
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

async function upsertCartFulfillment(cartId, fulfillment = {}, meta = {}) {
	// fulfillment: { service, address, coords, date, time }
	// meta: { title, providerType, providerRestaurantId }
	const payload = {
		status: 'draft',
		provider_type: meta?.providerType ?? null,
		provider_restaurant_id: meta?.providerRestaurantId ?? null,
		fulfillment_service: fulfillment?.service ?? null,
		fulfillment_address: fulfillment?.address ?? null,
		fulfillment_latitude: fulfillment?.coords?.lat ?? null,
		fulfillment_longitude: fulfillment?.coords?.lng ?? null,
		fulfillment_date: fulfillment?.date ?? null,
		fulfillment_time: fulfillment?.time ?? null,
	};
	const { error } = await supabase.from('meal_carts').update(payload).eq('id', cartId);
	if (error) throw error;
}

async function listOpenCarts(teamId) {
  // carts (not submitted)
  const { data: carts, error } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id, status, title, provider_type, provider_restaurant_id,
      fulfillment_service, fulfillment_address, fulfillment_latitude, fulfillment_longitude,
      fulfillment_date, fulfillment_time, created_at, updated_at,
      restaurants:restaurant_id ( id, name, image_url, cuisine_type )
    `)
    .eq('team_id', teamId)
    .neq('status', 'submitted')
    .order('updated_at', { ascending: false }); // secondary fallback, we'll sort in JS

  if (error) throw error;
  if (!carts?.length) return [];

  // totals + count per cart
  const ids = carts.map((c) => c.id);
  const { data: items, error: itemsErr } = await supabase
    .from('meal_cart_items')
    .select('cart_id, price, quantity')
    .in('cart_id', ids);

  if (itemsErr) throw itemsErr;

  const aggregates = new Map();
  for (const row of items || []) {
    const arr = aggregates.get(row.cart_id) || [];
    arr.push(row);
    aggregates.set(row.cart_id, arr);
  }

  // helper: build a local timestamp (ms) from date + time (if date exists)
  const toMs = (d, t) => {
    if (!d) return null;
    // If time missing, default to midday to keep ordering sane
    const safeTime = (t && String(t).slice(0, 8)) || '12:00:00';
    const iso = `${d}T${safeTime}`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  };

  const list = carts.map((c) => {
    const li = aggregates.get(c.id) || [];
    const itemCount = li.reduce((n, it) => n + Number(it.quantity || 0), 0);
    const subtotal = li.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);

    const scheduledAtMs = toMs(c.fulfillment_date, c.fulfillment_time);

    return {
      id: c.id,
      restaurant: c.restaurants
        ? {
            id: c.restaurants.id,
            name: c.restaurants.name,
            image: c.restaurants.image_url,
            cuisine: c.restaurants.cuisine_type,
          }
        : null,
      title:
        c.title ||
        (c.restaurants?.name ? `${c.restaurants.name} • ${c.provider_type || 'Cart'}` : 'Cart'),
      providerType: c.provider_type,
      providerRestaurantId: c.provider_restaurant_id,
      status: c.status,
      itemCount,
      subtotal,
      fulfillment: {
        service: c.fulfillment_service,
        address: c.fulfillment_address,
        coords:
          c.fulfillment_latitude != null && c.fulfillment_longitude != null
            ? { lat: c.fulfillment_latitude, lng: c.fulfillment_longitude }
            : null,
        date: c.fulfillment_date || null,
        time: c.fulfillment_time || null,
      },
      updatedAt: c.updated_at,
      createdAt: c.created_at,
      // internal field for sorting only (not required by UI)
      _scheduledAtMs: scheduledAtMs,
    };
  });

  // Sort order:
  // 1) carts with a schedule come before unscheduled
  // 2) among scheduled: soonest upcoming first; then most recent past
  // 3) among unscheduled: newest updated first (fallback)
  const now = Date.now();
  list.sort((a, b) => {
    const aHas = a._scheduledAtMs != null;
    const bHas = b._scheduledAtMs != null;
    if (aHas !== bHas) return aHas ? -1 : 1; // scheduled first

    // both unscheduled -> newest updated first
    if (!aHas && !bHas) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    // both scheduled
    const aFuture = a._scheduledAtMs >= now;
    const bFuture = b._scheduledAtMs >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1; // upcoming before past

    // both upcoming -> earlier first
    if (aFuture) return a._scheduledAtMs - b._scheduledAtMs;

    // both past -> closest to now (most recent past) first
    return b._scheduledAtMs - a._scheduledAtMs;
  });

  // strip internal field before returning (optional)
  return list.map(({ _scheduledAtMs, ...rest }) => rest);
}


async function deleteCart(cartId) {
  // Return deleted row id; surface RLS “no-op” as an error so the UI can show it
  const { data, error, count } = await supabase
    .from('meal_carts')
    .delete({ count: 'exact' })
    .eq('id', cartId)
    .select('id');

  if (error) throw error;

  const affected = typeof count === 'number' ? count : (data?.length ?? 0);
  if (affected === 0) {
    throw new Error('Cart not deleted (not found or insufficient permissions).');
  }
}

async function markSubmitted(cartId) {
	const { error } = await supabase
		.from('meal_carts')
		.update({ status: 'submitted' })
		.eq('id', cartId);
	if (error) throw error;
}

export default {
	findActiveCartForRestaurant,
  ensureCartForRestaurant,
  getCartSnapshot,
  addItem,
  updateItem,
  removeItem,
  subscribeToCart,
	upsertCartFulfillment,
	listOpenCarts,
	deleteCart,
	markSubmitted,
  updateCartTitle
};
