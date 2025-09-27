// src/services/cartDBService.js
import { supabase } from '../lib/supabase';
import { toTitleCase } from '../utils/stringUtils';
import { featureFlags } from '../config/runtimeConfig';
import { mealmeApi } from './mealmeApi';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
// Assignment helpers
// ---------------------------------------------------------------------------

function deriveAssignmentFields({ quantity, assignment = {} }) {
  const fallbackQty = Math.max(1, Number(quantity || 1));

  const memberIdsArray = Array.isArray(assignment.memberIds)
    ? assignment.memberIds.filter((id) => UUID_RE.test(id))
    : [];
  const secondaryMemberId =
    typeof assignment.memberId === 'string' && UUID_RE.test(assignment.memberId)
      ? assignment.memberId
      : null;
  const normalizedMemberIds = memberIdsArray.length
    ? memberIdsArray
    : secondaryMemberId
    ? [secondaryMemberId]
    : [];
  const unitsByMember = assignment.unitsByMember || {};
  const extraCountRaw =
    assignment.extraCount ??
    assignment.extrasCount ??
    (Array.isArray(assignment.extras) ? assignment.extras.length : 0) ??
    0;
  const extraCount = Math.max(0, Number(extraCountRaw || 0));

  if (normalizedMemberIds.length > 0) {
    const memberId = normalizedMemberIds[0];
    const rawUnits = Number(unitsByMember?.[memberId]);
    const qty = Number.isFinite(rawUnits) && rawUnits > 0 ? Math.floor(rawUnits) : fallbackQty;
    const safeQty = Math.max(1, qty || 0);
    return { quantity: safeQty, memberId, isExtra: false };
  }

  if (extraCount > 0) {
    const qty = Math.max(1, Math.floor(extraCount));
    return { quantity: qty, memberId: null, isExtra: true };
  }

  return { quantity: fallbackQty, memberId: null, isExtra: false };
}

function stripAssignmentSnapshot(selectedOptions) {
  if (!selectedOptions || typeof selectedOptions !== 'object' || Array.isArray(selectedOptions)) {
    return selectedOptions || null;
  }
  const next = { ...selectedOptions };
  if ('__assignment__' in next) delete next.__assignment__;
  return next;
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

function mapCartItemRow(it) {
  const memberId = it?.member_id || null;
  const isExtra = Boolean(it?.is_extra);
  const quantity = Math.max(1, Number(it?.quantity || 1));
  const price = Number(it?.price || 0);
  const rawOptions = it?.selected_options;
  const normalizedOptions =
    rawOptions && typeof rawOptions === 'object' && !Array.isArray(rawOptions) ? rawOptions : {};
  const assigneeRecord = it?.assignee || it?.team_members || null;
  const assignedTo = (() => {
    if (isExtra) {
      return [{ name: 'Extra', isExtra: true }];
    }
    if (memberId) {
      const name = assigneeRecord?.full_name || assigneeRecord?.email || null;
      return [{ id: memberId, name: name || 'Team member' }];
    }
    return [];
  })();

  return {
    id: it?.id,
    name: it?.item_name || it?.menu_items?.name || 'Item',
    quantity,
    price,
    image: it?.menu_items?.image_url || null,
    selectedOptions: normalizedOptions,
    specialInstructions: it?.special_instructions || '',
    menuItemId: it?.menu_item_id || it?.menu_items?.id,
    assignedTo,
    assignmentMemberIds: memberId ? [memberId] : [],
    assignmentExtras: isExtra ? quantity : 0,
    memberId,
    isExtra,
    addedByMemberId: it?.added_by_member_id || null,
  };
}

async function getCartSnapshot(cartId) {
  // cart & its restaurant
  const { data: cart, error: cartErr } = await supabase
    .from('meal_carts')
    .select(`
      id, team_id, restaurant_id, provider_type, provider_restaurant_id, provider_cart_id, provider_metadata, title,
      created_by_member_id,
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
      member_id, is_extra,
      menu_items ( id, name, image_url ),
      assignee:member_id ( id, full_name, email )
    `)
    .eq('cart_id', cartId)
    .order('created_at', { ascending: true });

  if (itemsErr) throw itemsErr;

  const mapped = (items || []).map(mapCartItemRow);

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
      createdByMemberId: cart.created_by_member_id ?? null,
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
    assignmentMemberIdsSnapshot: Array.from(
      new Set(
        mapped.flatMap((item) =>
          Array.isArray(item.assignmentMemberIds) ? item.assignmentMemberIds.filter(Boolean) : []
        )
      )
    ),
  };
}

async function getCartMembers(cartId) {
  if (!cartId) return [];
  const { data, error } = await supabase
    .from('meal_cart_members')
    .select('member_id')
    .eq('cart_id', cartId);
  if (error) throw error;
  return (data || []).map((row) => row.member_id);
}

async function setCartMembers(cartId, memberIds = []) {
  if (!cartId) throw new Error('Missing cartId');
  const unique = Array.from(new Set((memberIds || []).filter(Boolean)));

  try {
    await supabase.rpc('join_cart_as_member', { p_cart_id: cartId });
  } catch (err) {
    console.warn('join_cart_as_member failed before syncing members:', err?.message || err);
  }

  if (unique.length === 0) {
    const { error } = await supabase
      .from('meal_cart_members')
      .delete()
      .eq('cart_id', cartId);
    if (error) throw error;
    return;
  }

  const { data: existingRows, error: existingErr } = await supabase
    .from('meal_cart_members')
    .select('member_id')
    .eq('cart_id', cartId);
  if (existingErr) throw existingErr;

  const existingSet = new Set((existingRows || []).map((row) => row.member_id));
  const uniqueSet = new Set(unique);
  const toDelete = Array.from(existingSet).filter((id) => !uniqueSet.has(id));

  if (toDelete.length) {
    const { error: deleteErr } = await supabase
      .from('meal_cart_members')
      .delete()
      .eq('cart_id', cartId)
      .in('member_id', toDelete);
    if (deleteErr) throw deleteErr;
  }

  const { data: memberRows, error: memberErr } = await supabase
    .from('team_members')
    .select('id, user_id')
    .in('id', unique);
  if (memberErr) throw memberErr;

  const userMap = new Map((memberRows || []).map((row) => [row.id, row.user_id]));

  const toInsert = unique.filter((memberId) => !existingSet.has(memberId));
  if (!toInsert.length) return;

  const rows = toInsert.map((memberId) => ({
    cart_id: cartId,
    member_id: memberId,
    user_id: userMap.get(memberId) || null,
  }));

  const { error: insertErr } = await supabase
    .from('meal_cart_members')
    .insert(rows);
  if (insertErr) throw insertErr;
}

async function listCartMembersDetailed(cartId) {
  if (!cartId) return [];

  const ids = await getCartMembers(cartId);
  if (!ids.length) return [];

  const { data, error } = await supabase
    .from('team_members')
    .select('id, full_name, email, role')
    .in('id', ids);
  if (error) throw error;

  const map = new Map((data || []).map((row) => [row.id, row]));
  return ids.map((id) => {
    const row = map.get(id) || {};
    return {
      id,
      fullName: row.full_name || null,
      email: row.email || null,
      role: row.role || null,
    };
  });
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

  const { quantity: normalizedQty, memberId, isExtra } = deriveAssignmentFields({ quantity, assignment });
  const sanitizedOptions = stripAssignmentSnapshot(selectedOptions);

  const addedBy =
    typeof addedByMemberId === 'string' && UUID_RE.test(addedByMemberId)
      ? addedByMemberId
      : null;

  const payload = {
    cart_id: cartId,
    menu_item_id: menuItem?.id || null,
    item_name: menuItem?.name || 'Item',
    quantity: Math.max(1, Number(normalizedQty || 1)),
    price: Number(unitPrice || 0),
    special_instructions: specialInstructions || '',
    selected_options: sanitizedOptions,
    added_by_member_id: addedBy,
    member_id: isExtra ? null : memberId || null,
    is_extra: Boolean(isExtra),
  };

  const { data, error } = await supabase
    .from('meal_cart_items')
    .insert(payload)
    .select('id')
    .single();

  if (error) throw error;
  const itemId = data.id;

  if (featureFlags.mealMeEnabled) {
    const cartInfo = await getCartProviderInfo(cartId);
    await syncMealMeCartItemAdd(cartId, cartInfo, itemId, {
      menuItem,
      quantity: payload.quantity,
      unitPrice,
      specialInstructions,
      selectedOptions: sanitizedOptions,
    });
  }

  return itemId;
}

async function updateItem(cartId, itemId, patch) {
  const wantsQty = typeof patch.quantity === 'number';

  const sanitizedOptions =
    patch.selected_options !== undefined
      ? stripAssignmentSnapshot(patch.selected_options)
      : patch.selectedOptions !== undefined
      ? stripAssignmentSnapshot(patch.selectedOptions)
      : undefined;

  let nextMemberId =
    patch.memberId !== undefined ? patch.memberId : patch.member_id;
  if (typeof nextMemberId === 'string' && !UUID_RE.test(nextMemberId)) {
    nextMemberId = null;
  } else if (nextMemberId !== undefined && nextMemberId !== null && typeof nextMemberId !== 'string') {
    nextMemberId = null;
  }

  let nextIsExtra =
    patch.isExtra !== undefined ? patch.isExtra : patch.is_extra;
  if (nextIsExtra !== undefined) {
    nextIsExtra = Boolean(nextIsExtra);
  }
  if (nextIsExtra === true) {
    nextMemberId = null;
  }

  const payload = {
    ...(wantsQty ? { quantity: Math.max(1, Number(patch.quantity || 1)) } : {}),
    ...(typeof patch.price === 'number' ? { price: patch.price } : {}),
    ...(typeof patch.special_instructions === 'string' ? { special_instructions: patch.special_instructions } : {}),
    ...(sanitizedOptions !== undefined ? { selected_options: sanitizedOptions } : {}),
  };

  if (nextMemberId !== undefined) {
    payload.member_id = nextMemberId;
  }
  if (nextIsExtra !== undefined) {
    payload.is_extra = Boolean(nextIsExtra);
    if (payload.is_extra) {
      payload.member_id = null;
    }
  }

  const { data, error } = await supabase
    .from('meal_cart_items')
    .update(payload)
    .eq('id', itemId)
    .eq('cart_id', cartId)
    .select('id, quantity')
    .single();
  if (error) throw error;

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

async function updateItemFull(
  cartId,
  itemId,
  { quantity, unitPrice, specialInstructions, selectedOptions, assignment = {} }
) {
  const { quantity: normalizedQty, memberId, isExtra } = deriveAssignmentFields({ quantity, assignment });
  const sanitizedOptions = stripAssignmentSnapshot(selectedOptions);

  const payload = {
    quantity: Math.max(1, Number(normalizedQty || 1)),
    price: Number(unitPrice || 0),
    special_instructions: specialInstructions || '',
    selected_options: sanitizedOptions,
    member_id: isExtra ? null : memberId || null,
    is_extra: Boolean(isExtra),
  };

  const { data, error } = await supabase
    .from('meal_cart_items')
    .update(payload)
    .eq('id', itemId)
    .eq('cart_id', cartId)
    .select('id')
    .single();
  if (error) throw error;

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
  getCartMembers,
  setCartMembers,
  listCartMembersDetailed,
  getSharedCartMeta,
  joinCartWithEmail,
  updateItemFull,
};
