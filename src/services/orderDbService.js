// src/services/orderDbService.js
import { supabase } from '../lib/supabase';

function deriveAddressParts(full) {
  if (!full) return { line1: null, line2: null, city: null, state: null, zip: null };

  const parts = String(full)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Drop trailing country if present
  const last = (parts[parts.length - 1] || '').toLowerCase();
  const isCountry = ['us', 'usa', 'united states', 'united states of america'].includes(last);
  const core = isCountry ? parts.slice(0, -1) : parts;

  // Expect: [...line parts..., city, "ST ZIP"]
  if (core.length >= 3) {
    const stateZip = core[core.length - 1];          // "CA 94087" or "CA 94087-1234"
    const city = core[core.length - 2];
    const m = stateZip.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);

    if (m) {
      const state = m[1].toUpperCase();
      const zip = m[2];
      const lineParts = core.slice(0, -2);           // one or more lines
      const line1 = lineParts[0] || null;
      const line2 = lineParts.slice(1).join(', ') || null;
      return { line1, line2, city, state, zip };
    }
  }

  // Fallback (keeps inserts from breaking; you only enforce full address when advancing status)
  return { line1: String(full).trim(), line2: null, city: 'TBD', state: 'NA', zip: '00000' };
}

function toScheduledDate(cart) {
  const d = cart?.cart?.fulfillment_date;
  const t = cart?.cart?.fulfillment_time;
  if (d && t) return new Date(`${d}T${t}`).toISOString();
  return new Date().toISOString();
}

export const orderDbService = {
  async createDraftFromCart({
    cartSnapshot,
    orderInput,
    quote,
    provider,        // 'mealme'|'stripe'|'manual'
    isSandbox,
    createdBy,
    paymentMethodId,
    deliveryInstructions,
    account,         // { name, email, phone }
    paymentSnapshot,
    promoCode,
    promoDiscountCents,
  }) {
    const teamId = cartSnapshot?.cart?.teamId || cartSnapshot?.cart?.team_id;
    const restaurantId = cartSnapshot?.restaurant?.id || cartSnapshot?.cart?.restaurant_id || null;

    const fulfillmentMethod = (cartSnapshot?.cart?.fulfillment_service || 'delivery'); // 'delivery'|'pickup'
    const scheduledDate = toScheduledDate(cartSnapshot);

    let addr = { line1: null, line2: null, city: null, state: null, zip: null };
    if (fulfillmentMethod === 'delivery') {
      addr = deriveAddressParts(cartSnapshot?.cart?.fulfillment_address);
    }

    const insertRow = {
      team_id: teamId,
      restaurant_id: restaurantId,
      title: cartSnapshot?.cart?.title || 'Team Order',
      meal_type: cartSnapshot?.cart?.meal_type || null,
      scheduled_date: scheduledDate,

      order_status: 'draft',

      created_by: createdBy || null,
      api_source: provider === 'mealme' ? 'mealme' : (provider || 'manual'),
      is_sandbox: !!isSandbox,

      fulfillment_method: fulfillmentMethod,
      driver_tip_cents: fulfillmentMethod === 'delivery' ? (orderInput?.driver_tip_cents ?? quote?.driver_tip_cents ?? 0) : 0,
      pickup_tip_cents:  fulfillmentMethod === 'pickup'   ? (orderInput?.pickup_tip_cents ?? quote?.pickup_tip_cents ?? 0)  : 0,

      // contact
      user_name:  account?.name  || null,
      user_email: account?.email || null,
      user_phone: account?.phone || null,

      // address & instructions
      delivery_address_line1: fulfillmentMethod === 'delivery' ? addr.line1 : null,
      delivery_address_line2: fulfillmentMethod === 'delivery' ? addr.line2 : null,
      delivery_city:          fulfillmentMethod === 'delivery' ? addr.city  : null,
      delivery_state:         fulfillmentMethod === 'delivery' ? addr.state : null,
      delivery_zip:           fulfillmentMethod === 'delivery' ? addr.zip   : null,
      delivery_latitude:      fulfillmentMethod === 'delivery' ? (orderInput?.user_latitude  ?? null) : null,
      delivery_longitude:     fulfillmentMethod === 'delivery' ? (orderInput?.user_longitude ?? null) : null,
      delivery_instructions:  deliveryInstructions || null,
      user_pickup_notes:      fulfillmentMethod === 'pickup' ? (orderInput?.user_pickup_notes || null) : null,

      // fees/totals
      subtotal_cents:        quote?.subtotal_cents ?? null,
      delivery_fee_cents:    quote?.fees_cents ?? null,
      service_fee_cents:     quote?.service_fee_cents ?? null,
      sales_tax_cents:       quote?.tax_cents ?? null,
      tip_cents:             quote?.tip_cents ?? null,
      total_with_tip_cents:  quote?.total_with_tip_cents ?? null,
      total_without_tips_cents:
        (quote?.total_with_tip_cents != null && quote?.tip_cents != null)
            ? Math.max(0, quote.total_with_tip_cents - quote.tip_cents)
            // fallback if provider doesn’t return those:
            : Math.max(
                0,
                (quote?.subtotal_cents ?? 0) +
                (quote?.fees_cents ?? 0) +
                (quote?.service_fee_cents ?? 0) +
                (quote?.tax_cents ?? 0) -
                (promoDiscountCents ?? 0)
            ),

      // promo
      promo_code:            promoCode || null,
      promo_discount_cents:  promoDiscountCents ?? null,

      // payment
      payment_method_id: paymentMethodId || null,
      payment_status: 'pending',

      // snapshots
      request_payload: {
        orderInput: orderInput ?? null,
        ui_payment_snapshot: paymentSnapshot ?? null,
      },
      final_quote_json: quote ?? null,

      include_final_quote: true,
      place_order: false,
    };
    const { data, error } = await supabase
      .from('meal_orders')
      .insert(insertRow)
      .select('id')
      .single();
    if (error) throw error;

    const orderId = data.id;

    const items = (cartSnapshot?.items || []).map(i => ({
      order_id: orderId,
      team_member_id: i.assigned_to_member_id || null,
      product_id: i.product_id || i.id,
      name: i.item_name || i.name,
      description: i.description || null,
      image_url: i.image_url || null,
      notes: i.special_instructions || i.notes || null,
      quantity: Number(i.quantity || 1),
      product_marked_price_cents: Math.round(Number(i.price || 0) * 100),
    }));
    if (items.length) {
      const { error: itemsErr } = await supabase.from('meal_order_items').insert(items);
      if (itemsErr) throw itemsErr;
    }

    await supabase.from('meal_carts')
      .update({ status: 'submitted' })
      .eq('id', cartSnapshot.cart.id);

    return { localOrderId: orderId };
  },

  async markPendingConfirmation(localOrderId) {
    const { error } = await supabase
      .from('meal_orders')
      .update({ order_status: 'pending_confirmation' })
      .eq('id', localOrderId);
    if (error) throw error;
  },

  async markConfirmed(localOrderId, extra = {}) {
    const { error } = await supabase
      .from('meal_orders')
      .update({ order_status: 'confirmed', order_placed: true, payment_status: 'completed', ...extra })
      .eq('id', localOrderId);
    if (error) throw error;
  },

  async markFailed(localOrderId, message) {
    const { error } = await supabase
      .from('meal_orders')
      .update({ order_status: 'failed', payment_status: 'failed', response_payload: { error: message } })
      .eq('id', localOrderId);
    if (error) throw error;
  },

  async attachProviderInfo(localOrderId, patch = {}) {
    const { error } = await supabase
      .from('meal_orders')
      .update(patch)
      .eq('id', localOrderId);
    if (error) throw error;
  },
};