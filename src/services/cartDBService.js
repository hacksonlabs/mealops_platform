// src/services/cartDBService.js
import { supabase } from '../lib/supabase';
import { toTitleCase } from '../utils/stringUtils';
import { featureFlags } from '../config/runtimeConfig';
import { mealmeApi } from './mealmeApi';
/**
 * We keep a snapshot in selected_options.__assignment__ for quick UI use:
 * {
 *   __assignment__: {
 *     member_ids: [uuid, ...],   // team_members.id
 *     extra_count: number,       // how many "Extra" meals (total units)
 *     display_names: [string]    // snapshot for quick rendering in header
 *     // (optional) units_by_member: { [memberId]: units }  // if you choose to persist
 *   },
 *   ...other option groups...
 * }
 */

const normalizeTitle = (t) => {
  const s = (t ?? '').trim();
  if (!s) return 'Team Cart';
  return toTitleCase(s);
};

const normalizeDbTime = (t) => {
  if (!t) return null;
  const parts = String(t).split(':');
  const [hh = '00', mm = '00', ss = '00'] = parts;
  return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}:${(ss || '00').padStart(2, '0')}`;
};

async function maybeCreateMealMeCart(cartId, {
  teamId,
  providerRestaurantId,
  fulfillment,
  title,
} = {}) {
  if (!featureFlags.mealMeEnabled) return null;
  if (!providerRestaurantId) return null;
  try {
    const whenDate = fulfillment?.date;
    const whenTime = fulfillment?.time ? normalizeDbTime(fulfillment.time) : null;
    const scheduledAt = whenDate && whenTime ? `${whenDate}T${whenTime}` : null;
    const payload = {
      provider_restaurant_id: providerRestaurantId,
      team_id: teamId,
      service_type: fulfillment?.service || 'delivery',
      scheduled_at: scheduledAt || undefined,
      address: fulfillment?.address || undefined,
      latitude: fulfillment?.coords?.lat,
      longitude: fulfillment?.coords?.lng,
      cart_name: title || undefined,
    };
    const response = await mealmeApi.createCart(payload);
    const providerCartId = response?.cart_id || response?.id || response?.data?.cart_id || null;
    await supabase
      .from('meal_carts')
      .update({
        provider_cart_id: providerCartId,
        provider_metadata: {
          ...(response ? { mealme: response } : {}),
        },
      })
      .eq('id', cartId);
    return providerCartId;
  } catch (error) {
    console.warn('MealMe cart creation failed:', error?.message || error);
    return null;
  }
}

const toMealMeLineItem = ({ menuItem, quantity, unitPrice, specialInstructions, selectedOptions }) => {
  const price = unitPrice != null ? Number(unitPrice) : Number(menuItem?.price ?? 0);
  const payload = {
    provider_item_id: menuItem?.provider_item_id || menuItem?.api_id || menuItem?.id || null,
    name: menuItem?.name || menuItem?.item_name || 'Item',
    quantity: Number.isFinite(Number(quantity)) ? Math.max(1, Number(quantity)) : 1,
    price_cents: Math.round(Number.isFinite(price) ? price * 100 : 0),
    special_instructions: specialInstructions || undefined,
  };
  if (selectedOptions) payload.selected_options = selectedOptions;
  return payload;
};

async function syncMealMeCartItemAdd(cartId, cartInfo, localItemId, ctx) {
  if (!featureFlags.mealMeEnabled) return;
  if (cartInfo?.provider_type !== 'mealme') return;

  let providerCartId = cartInfo?.provider_cart_id;
  if (!providerCartId) {
    providerCartId = await maybeCreateMealMeCart(cartId, {
      teamId: cartInfo?.team_id,
      providerRestaurantId: cartInfo?.provider_restaurant_id,
      fulfillment: {
        service: cartInfo?.fulfillment_service,
        address: cartInfo?.fulfillment_address,
        coords: cartInfo?.fulfillment_latitude != null && cartInfo?.fulfillment_longitude != null
          ? { lat: cartInfo.fulfillment_latitude, lng: cartInfo.fulfillment_longitude }
          : null,
        date: cartInfo?.fulfillment_date ?? undefined,
        time: cartInfo?.fulfillment_time ?? undefined,
      },
      title: ctx?.title,
    });
    const refreshed = await getCartProviderInfo(cartId);
    cartInfo = { ...refreshed };
  }

  if (!cartInfo?.provider_cart_id) return;

  try {
    const payload = {
      cart_id: cartInfo.provider_cart_id,
      provider_restaurant_id: cartInfo.provider_restaurant_id,
      line_item: toMealMeLineItem(ctx),
    };
    const response = await mealmeApi.addItemToCart(cartInfo.provider_cart_id, payload);
    const providerLineId = response?.line_item_id || response?.id || response?.data?.line_item_id || null;
    await supabase
      .from('meal_cart_items')
      .update({
        provider_line_item_id: providerLineId,
        provider_payload: {
          ...(response ? { mealme: response } : {}),
        },
      })
      .eq('id', localItemId);
  } catch (error) {
    console.warn('MealMe addItem sync failed:', error?.message || error);
  }
}

async function syncMealMeCartItemRemove(cartId, itemInfo) {
  if (!featureFlags.mealMeEnabled) return;
  const cartInfo = await getCartProviderInfo(cartId);
  if (cartInfo?.provider_type !== 'mealme') return;
  if (!cartInfo?.provider_cart_id) return;
  if (!itemInfo?.provider_line_item_id) return;
  try {
    await mealmeApi.removeItemFromCart(cartInfo.provider_cart_id, {
      cart_id: cartInfo.provider_cart_id,
      provider_restaurant_id: cartInfo.provider_restaurant_id,
      line_item_id: itemInfo.provider_line_item_id,
    });
  } catch (error) {
    console.warn('MealMe removeItem sync failed:', error?.message || error);
  }
}

async function syncMealMeCartItemUpdate(cartId, itemId) {
  if (!featureFlags.mealMeEnabled) return;
  const cartInfo = await getCartProviderInfo(cartId);
  if (cartInfo?.provider_type !== 'mealme') return;
  if (!cartInfo?.provider_cart_id) return;

  const { data } = await supabase
    .from('meal_cart_items')
    .select(`
      id, provider_line_item_id, item_name, price, quantity, special_instructions, selected_options,
      menu_item_id,
      menu_items ( id, name, api_id )
    `)
    .eq('id', itemId)
    .maybeSingle();

  if (!data) return;

  const menuItem = {
    id: data.menu_item_id || data.menu_items?.id,
    name: data.menu_items?.name || data.item_name,
    provider_item_id: data.menu_items?.api_id || data.provider_line_item_id,
  };

  if (data.provider_line_item_id) {
    await syncMealMeCartItemRemove(cartId, data);
  }

  await syncMealMeCartItemAdd(cartId, cartInfo, itemId, {
    menuItem,
    quantity: data.quantity,
    unitPrice: data.price,
    specialInstructions: data.special_instructions,
    selectedOptions: data.selected_options,
  });
}

// ---------------------------------------------------------------------------
// Assignment helpers: compute + persist unit quantities per assignee/extras
// ---------------------------------------------------------------------------

/**
 * Compute per-member units and extras to match a target quantity.
 * If quantity is missing/invalid, it is derived from unitsByMember+extraCount
 * or falls back to (memberIds.length + extraCount) or 1.
 */
function computeUnits({ quantity, memberIds = [], unitsByMember = {}, extraCount = 0 }) {
  const ids = Array.from(new Set(memberIds)); // de-dupe, keep order
  const units = {};
  let baseTot = 0;

  // start with provided units or default 1 per member
  for (const id of ids) {
    const raw = Number(unitsByMember?.[id]);
    const u = Number.isFinite(raw) && raw > 0 ? raw : 1;
    units[id] = u;
    baseTot += u;
  }

  // extras are ONLY the explicit extras the user asked for
  let extras = Math.max(0, Number(extraCount || 0));

  // target quantity
  let targetQty = Number(quantity);
  if (!Number.isFinite(targetQty) || targetQty <= 0) {
    // if quantity omitted, derive from current plan or at least 1
    targetQty = Math.max(1, baseTot || ids.length || extras || 1);
  }

  // If no members are selected, treat everything beyond explicit extras as unassigned.
  if (ids.length === 0) {
    const clampedExtras = Math.min(extras, targetQty);
    const unassigned = Math.max(0, targetQty - clampedExtras);
    return { targetQty, units: {}, extras: clampedExtras, unassigned };
  }

  extras = Math.min(extras, Math.max(0, targetQty - ids.length));
  const baseTotal = ids.length + extras;

  let unassigned = 0;

  if (targetQty > baseTotal) {
    unassigned = targetQty - baseTotal;
  } else if (targetQty < baseTotal) {
    let toRemove = baseTotal - targetQty;

    const cut = Math.min(extras, toRemove);
    extras -= cut;
    toRemove -= cut;

    for (let i = ids.length - 1; i >= 0 && toRemove > 0; i--) {
      const id = ids[i];
      const take = Math.min(units[id], toRemove);
      units[id] -= take;
      toRemove -= take;
    }

    for (const id of Object.keys(units)) {
      if (units[id] <= 0) delete units[id];
    }
  }

  return { targetQty, units, extras, unassigned };
}


/** Replace all assignees with explicit unit_qty (single extras row if extras>0). */
async function writeAssigneesWithUnits(itemId, { unitsByMember = {}, extras = 0, unassigned = 0 }) {
  const rows = [
    ...Object.entries(unitsByMember).map(([member_id, unit_qty]) => ({
      cart_item_id: itemId,
      member_id,
      is_extra: false,
      unit_qty: Math.max(0, Number(unit_qty || 0)),
    })),
    ...(extras > 0
      ? [{
          cart_item_id: itemId,
          is_extra: true,
          unit_qty: Math.max(0, Number(extras || 0)),
        }]
      : []),
    ...(unassigned > 0
      ? [{
          cart_item_id: itemId,
          member_id: null,
          is_extra: false,
          unit_qty: Math.max(0, Number(unassigned || 0)),
        }]
      : []),
  ].filter(r => r.unit_qty > 0);

  // wipe then insert
  const { error: delErr } = await supabase
    .from('meal_cart_item_assignees')
    .delete()
    .eq('cart_item_id', itemId);
  if (delErr) throw delErr;

  if (rows.length) {
    const { error: insErr } = await supabase
      .from('meal_cart_item_assignees')
      .insert(rows);
    if (insErr) throw insErr;
  }
}

/**
 * When only quantity changes (no new assignment payload), adjust current
 * assignments so the trigger passes. Extras absorb changes first.
 */
async function syncAssigneesToQuantity(itemId, newQty) {
  const { data: asg, error } = await supabase
    .from('meal_cart_item_assignees')
    .select('member_id, is_extra, unit_qty')
    .eq('cart_item_id', itemId);
  if (error) throw error;

  const unitsByMember = {};
  let extras = 0;

  for (const r of asg || []) {
    if (r.is_extra) extras += Number(r.unit_qty || 0);
    else unitsByMember[r.member_id] = Math.max(0, Number(r.unit_qty || 0));
  }

  const memberIds = Object.keys(unitsByMember);
  const { targetQty, units, extras: ex, unassigned } = computeUnits({
    quantity: newQty,
    memberIds,
    unitsByMember,
    extraCount: extras,
  });

  await writeAssigneesWithUnits(itemId, { unitsByMember: units, extras: ex, unassigned });
  return targetQty;
}

// ---------------------------------------------------------------------------
// Cart querying/creation
// ---------------------------------------------------------------------------

// If date is provided: match that date (and time if provided).
// If date is not provided: prefer carts with NULL date (unscheduled).
async function findActiveCartForRestaurant(teamId, restaurantId, providerType = null, fulfillment = {}, mealType = null) {
  let q = supabase
    .from('meal_carts')
    .select('id, fulfillment_date, fulfillment_time, updated_at')
    .eq('team_id', teamId)
    .eq('restaurant_id', restaurantId)
    .eq('status', 'draft');

  if (providerType != null) q = q.eq('provider_type', providerType);
  // keep carts separated by meal type (breakfast/lunch/dinner/etc.)
  if (mealType) q = q.eq('meal_type', mealType);
  else q = q.is('meal_type', null);

  const hasDate = Boolean(fulfillment?.date);
  const hasTime = Boolean(fulfillment?.time);

  if (hasDate) {
    q = q.eq('fulfillment_date', fulfillment.date);
    if (hasTime) q = q.eq('fulfillment_time', normalizeDbTime(fulfillment.time));
  } else {
    // No date selected yet? Prefer unscheduled carts.
    q = q.is('fulfillment_date', null);
  }

  q = q.order('updated_at', { ascending: false }).order('created_at', { ascending: false }).limit(1);

  const { data, error } = await q.maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

async function getCartProviderInfo(cartId) {
  const { data, error } = await supabase
    .from('meal_carts')
    .select('id, provider_type, provider_restaurant_id, provider_cart_id, provider_metadata, team_id, fulfillment_service, fulfillment_address, fulfillment_latitude, fulfillment_longitude, fulfillment_date, fulfillment_time')
    .eq('id', cartId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureCartForRestaurant(
  teamId,
  restaurantId,
  { title, providerType = null, providerRestaurantId = null, fulfillment = {}, mealType = null } = {}
) {
  const existingId = await findActiveCartForRestaurant(teamId, restaurantId, providerType, fulfillment, mealType);
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
      fulfillment_service: fulfillment?.service ?? null,
      fulfillment_address: fulfillment?.address ?? null,
      fulfillment_latitude: fulfillment?.coords?.lat ?? null,
      fulfillment_longitude: fulfillment?.coords?.lng ?? null,
      fulfillment_date: fulfillment?.date ?? null,
      fulfillment_time: normalizeDbTime(fulfillment?.time) ?? null,
      meal_type: mealType,
    })
    .select('id')
    .single();

  if (insErr) throw insErr;
  const cartId = created.id;

  if (providerType === 'mealme') {
    await maybeCreateMealMeCart(cartId, {
      teamId,
      providerRestaurantId,
      fulfillment,
      title: cleanTitle,
    });
  }

  return cartId;
}

export async function updateCartTitle(cartId, title) {
  const normalized = normalizeTitle(title);
  const { error } = await supabase
    .from('meal_carts')
    .update({ title: normalized })
    .eq('id', cartId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Snapshots & meta
// ---------------------------------------------------------------------------

async function getCartSnapshot(cartId) {
  // cart & its restaurant
  const { data: cart, error: cartErr } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id, provider_type, provider_restaurant_id, provider_cart_id, provider_metadata, title,
      fulfillment_service, fulfillment_address, fulfillment_latitude, fulfillment_longitude,
      fulfillment_date, fulfillment_time,
      restaurants ( id, name, image_url, address, phone_number, rating ),
      status, meal_type
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

  // derive abandoned state (draft + scheduled in the past)
  const toMs = (d, t) => {
    if (!d) return null;
    const safeTime = (t && String(t).slice(0, 8)) || '12:00:00';
    const ms = Date.parse(`${d}T${safeTime}`);
    return Number.isNaN(ms) ? null : ms;
  };
  const scheduledAtMs = toMs(cart.fulfillment_date, cart.fulfillment_time);
  const nowMs = Date.now();
  const baseStatus = cart.status ?? 'draft';
  const statusEffective = baseStatus === 'draft' && scheduledAtMs != null && scheduledAtMs < nowMs
    ? 'abandoned'
    : baseStatus;

  // Persist status flip to 'abandoned' when applicable
  if (statusEffective !== baseStatus) {
    try {
      await supabase.from('meal_carts').update({ status: statusEffective }).eq('id', cart.id);
    } catch (e) {
      // non-fatal; UI can still render derived status
      console.warn('Failed to persist cart status update:', e?.message || e);
    }
  }

  return {
    cart: {
      id: cart.id,
      teamId: cart.team_id,
      status: statusEffective,
      title: cart.title ?? cart.restaurants.name ?? null,
      fulfillment_service: cart.fulfillment_service ?? null,
      fulfillment_address: cart.fulfillment_address ?? null,
      fulfillment_latitude: cart.fulfillment_latitude ?? null,
      fulfillment_longitude: cart.fulfillment_longitude ?? null,
      fulfillment_date: cart.fulfillment_date ?? null,
      fulfillment_time: cart.fulfillment_time ?? null,
      meal_type: cart.meal_type ?? null,
      provider_cart_id: cart.provider_cart_id ?? null,
      provider_metadata: cart.provider_metadata ?? null,
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

export async function getSharedCartMeta(cartId) {
  // cart + restaurant + team
  const { data: cart, error: cartErr } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id, provider_type, provider_restaurant_id, title,
      created_by_member_id, status,
      fulfillment_service, fulfillment_address, fulfillment_latitude, fulfillment_longitude,
      fulfillment_date, fulfillment_time,
      restaurants:restaurant_id ( id, name, image_url, address, phone_number, rating, cuisine_type, supports_catering),
      teams:team_id ( id, name, gender, sport )
    `)
    .eq('id', cartId)
    .maybeSingle();
  if (cartErr) throw cartErr;
  if (!cart) return null;

  // Resolve organizer (team_member -> user_profiles)
  let creator = null;
  if (cart.created_by_member_id) {
    const { data: member, error: memberErr } = await supabase
      .from('team_members')
      .select(`
        id, user_id, role, full_name, email, phone_number,
        user:user_profiles ( id, first_name, last_name, email, phone )
      `)
      .eq('id', cart.created_by_member_id)
      .maybeSingle();
    if (memberErr) throw memberErr;
    if (member) {
      const fullName =
        member.full_name ||
        [member.user?.first_name, member.user?.last_name].filter(Boolean).join(' ') ||
        null;
      creator = {
        memberId: member.id,
        userId: member.user_id,
        role: member.role,
        fullName,
        email: member.email || member.user?.email || null,
        phone: member.phone_number || member.user?.phone || null,
      };
    }
  }

  return {
    cart: {
      id: cart.id,
      teamId: cart.team_id,
      status: cart.status ?? 'draft',
      title: cart.title ?? cart.restaurants?.name ?? null,
      providerType: cart.provider_type ?? null,
      providerRestaurantId: cart.provider_restaurant_id ?? null,
      fulfillment: {
        service: cart.fulfillment_service ?? null,
        address: cart.fulfillment_address ?? null,
        coords:
          cart.fulfillment_latitude != null && cart.fulfillment_longitude != null
            ? { lat: cart.fulfillment_latitude, lng: cart.fulfillment_longitude }
            : null,
        date: cart.fulfillment_date ?? null,
        time: cart.fulfillment_time ?? null,
      },
      createdByMemberId: cart.created_by_member_id ?? null,
    },
    restaurant: cart.restaurants
      ? {
          id: cart.restaurants.id,
          name: cart.restaurants.name,
          image: cart.restaurants.image_url,
          cuisine_type: cart.restaurants.cuisine_type || null,
          address: cart.restaurants.address || null,
          phone: cart.restaurants.phone_number || null,
          rating: cart.restaurants.rating ?? null,
          supports_catering: cart.restaurants.supports_catering ?? null,
        }
      : null,
    team: cart.teams
      ? {
          id: cart.teams.id,
          name: cart.teams.name,
          gender: cart.teams.gender,
          sport: cart.teams.sport,
        }
      : null,
    creator,
  };
}

// ---------------------------------------------------------------------------
// Mutations (items + assignments)
// ---------------------------------------------------------------------------

async function addItem(
  cartId,
  { menuItem, quantity, unitPrice, specialInstructions, selectedOptions, assignment, addedByMemberId }
) {
  try {
    await supabase.rpc('join_cart_as_member', { p_cart_id: cartId });
  } catch (err) {
    console.warn('join_cart_as_member failed:', err?.message || err);
  }

  // sanitize inputs
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const rawIds = assignment?.memberIds ?? [];
  const memberIds = rawIds.filter((id) => uuidRe.test(id));
  const unitsByMember = assignment?.unitsByMember || {}; // optional mapping { memberId: units }
  const inferredExtras = rawIds.filter((id) => id === '__EXTRA__').length;
  const extraCount = Math.max(assignment?.extraCount ?? 0, inferredExtras);

  // compute per-assignee units and final quantity
  const { targetQty, units, extras, unassigned } = computeUnits({
    quantity,
    memberIds,
    unitsByMember,
    extraCount,
  });

  // snapshot for UI
  const selected_options = {
    ...selectedOptions,
    __assignment__: {
      member_ids: memberIds,
      extra_count: extras,
      display_names: assignment?.displayNames || [],
      // units_by_member: units, // optional: persist for round-tripping
    },
  };

  const addedBy =
    typeof addedByMemberId === 'string' && uuidRe.test(addedByMemberId)
      ? addedByMemberId
      : null;

  // create the item with the final quantity
  const { data, error } = await supabase
    .from('meal_cart_items')
    .insert({
      cart_id: cartId,
      menu_item_id: menuItem?.id || null,
      item_name: menuItem?.name || 'Item',
      quantity: targetQty,
      price: Number(unitPrice || 0),
      special_instructions: specialInstructions || '',
      selected_options,
      added_by_member_id: addedBy,
    })
    .select('id')
    .single();

  if (error) throw error;
  const itemId = data.id;

  try {
    await writeAssigneesWithUnits(itemId, { unitsByMember: units, extras, unassigned });
  } catch (asgErr) {
    // rollback if assignments fail (triggers/RLS/etc.)
    await supabase.from('meal_cart_items').delete().eq('id', itemId).eq('cart_id', cartId);
    throw asgErr;
  }

  if (featureFlags.mealMeEnabled) {
    const cartInfo = await getCartProviderInfo(cartId);
    await syncMealMeCartItemAdd(cartId, cartInfo, itemId, {
      menuItem,
      quantity: targetQty,
      unitPrice,
      specialInstructions,
      selectedOptions: selected_options,
    });
  }

  return itemId;
}

async function updateItem(cartId, itemId, patch) {
  const wantsQty = typeof patch.quantity === 'number';

  // Update item fields
  const payload = {
    ...(wantsQty ? { quantity: Math.max(1, Number(patch.quantity || 1)) } : {}),
    ...(typeof patch.price === 'number' ? { price: patch.price } : {}),
    ...(typeof patch.special_instructions === 'string' ? { special_instructions: patch.special_instructions } : {}),
    ...(patch.selected_options !== undefined ? { selected_options: patch.selected_options } : {}),
  };

  const { data, error } = await supabase
    .from('meal_cart_items')
    .update(payload)
    .eq('id', itemId)
    .eq('cart_id', cartId)
    .select('id, quantity')
    .single();
  if (error) throw error;

  // If quantity changed (alone or with other fields), rebalance assignees.
  if (wantsQty) {
    await syncAssigneesToQuantity(itemId, payload.quantity);
  }

  if (featureFlags.mealMeEnabled) {
    await syncMealMeCartItemUpdate(cartId, itemId);
  }

  return data.id;
}

async function removeItem(cartId, itemId) {
  let snapshot = null;
  if (featureFlags.mealMeEnabled) {
    const { data } = await supabase
      .from('meal_cart_items')
      .select('id, provider_line_item_id')
      .eq('id', itemId)
      .maybeSingle();
    snapshot = data || null;
  }

  if (snapshot) {
    await syncMealMeCartItemRemove(cartId, snapshot);
  }

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
  // Determine status based on when the cart is scheduled
  const toMs = (d, t) => {
    if (!d) return null;
    const safeTime = (t && String(t).slice(0, 8)) || '12:00:00';
    const iso = `${d}T${safeTime}`;
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  };
  const normalizedTime = normalizeDbTime(fulfillment?.time) ?? null;
  const whenMs = toMs(fulfillment?.date ?? null, normalizedTime);
  const computedStatus = whenMs != null && whenMs < Date.now() ? 'abandoned' : 'draft';
  const payload = {
    status: computedStatus,
    provider_type: meta?.providerType ?? null,
    provider_restaurant_id: meta?.providerRestaurantId ?? null,
    fulfillment_service: fulfillment?.service ?? null,
    fulfillment_address: fulfillment?.address ?? null,
    fulfillment_latitude: fulfillment?.coords?.lat ?? null,
    fulfillment_longitude: fulfillment?.coords?.lng ?? null,
    fulfillment_date: fulfillment?.date ?? null,
    fulfillment_time: normalizedTime,
  };
  const { error } = await supabase.from('meal_carts').update(payload).eq('id', cartId);
  if (error) throw error;

  if (featureFlags.mealMeEnabled && (meta?.providerType ?? null) === 'mealme') {
    const info = await getCartProviderInfo(cartId);
    if (!info?.provider_cart_id) {
      await maybeCreateMealMeCart(cartId, {
        teamId: info?.team_id,
        providerRestaurantId: meta?.providerRestaurantId,
        fulfillment,
        title: meta?.title,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Listing / admin-y helpers
// ---------------------------------------------------------------------------

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
    .order('updated_at', { ascending: false });

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
      status: (c.status === 'draft' && scheduledAtMs != null && scheduledAtMs < Date.now()) ? 'abandoned' : c.status,
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
      _scheduledAtMs: scheduledAtMs,
    };
  });

  // Sort: scheduled first; among scheduled: upcoming then most recent past; among unscheduled: newest updated
  const now = Date.now();
  list.sort((a, b) => {
    const aHas = a._scheduledAtMs != null;
    const bHas = b._scheduledAtMs != null;
    if (aHas !== bHas) return aHas ? -1 : 1;

    if (!aHas && !bHas) {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    }

    const aFuture = a._scheduledAtMs >= now;
    const bFuture = b._scheduledAtMs >= now;
    if (aFuture !== bFuture) return aFuture ? -1 : 1;

    if (aFuture) return a._scheduledAtMs - b._scheduledAtMs;
    return b._scheduledAtMs - a._scheduledAtMs;
  });

  // Persist abandoned status for any past-dated drafts in one shot
  try {
    const toAbandon = list
      .filter((c) => c.status === 'draft' && c._scheduledAtMs != null && c._scheduledAtMs < Date.now())
      .map((c) => c.id);
    if (toAbandon.length > 0) {
      await supabase
        .from('meal_carts')
        .update({ status: 'abandoned' })
        .in('id', toAbandon)
        .eq('status', 'draft');
    }
  } catch (e) {
    console.warn('Failed to persist abandoned status for carts:', e?.message || e);
  }

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

export async function joinCartWithEmail(cartId, email) {
  const { data, error } = await supabase.rpc('join_cart_with_email', {
    p_cart_id: cartId,
    p_email: email,
  });
  if (error) throw error;

  // RPC RETURNS TABLE => Supabase returns an array (one row)
  const row = Array.isArray(data) ? data[0] : data;
  return {
    memberId: row?.member_id ?? null,
    fullName: row?.full_name ?? null,
    email: row?.email ?? email, // always send back an email
  };
}

// Back-compat helper if referenced elsewhere: assigns unit_qty=1 per member and
// a single extras row with unit_qty = extraCount.
async function replaceItemAssignees(itemId, memberIds = [], extraCount = 0) {
  const unitsByMember = {};
  for (const id of memberIds) unitsByMember[id] = 1;
  await writeAssigneesWithUnits(itemId, {
    unitsByMember,
    extras: Math.max(0, Number(extraCount || 0)),
  });
}

async function updateItemFull(
  cartId,
  itemId,
  { quantity, unitPrice, specialInstructions, selectedOptions, assignment = {} }
) {
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const memberIds = (assignment.memberIds || []).filter(id => uuidRe.test(id));
  const unitsByMember = assignment.unitsByMember || {};
  const extraCount = Math.max(0, Number(assignment.extraCount || 0));

  const { targetQty, units, extras, unassigned } = computeUnits({
    quantity,
    memberIds,
    unitsByMember,
    extraCount,
  });

  const selected_options = {
    ...(selectedOptions || {}),
    __assignment__: {
      member_ids: memberIds,
      extra_count: extras,
      display_names: selectedOptions?.__assignment__?.display_names || [],
      // units_by_member: units, // optional snapshot
    },
  };

  const { data, error } = await supabase
    .from('meal_cart_items')
    .update({
      quantity: targetQty,
      price: Number(unitPrice || 0),
      special_instructions: specialInstructions || '',
      selected_options,
    })
    .eq('id', itemId)
    .eq('cart_id', cartId)
    .select('id')
    .single();
  if (error) throw error;

  await writeAssigneesWithUnits(itemId, { unitsByMember: units, extras, unassigned });
  if (featureFlags.mealMeEnabled) {
    await syncMealMeCartItemUpdate(cartId, itemId);
  }
  return data.id;
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
  updateCartTitle,
  getSharedCartMeta,
  joinCartWithEmail,
  updateItemFull,
};
