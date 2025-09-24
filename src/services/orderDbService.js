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

const normalizePriceCents = (value) => {
  const num = Number(value);
  if (Number.isFinite(num)) return Math.round(num);
  return 0;
};

function extractCustomizationsFromSelections(selectedOptions) {
  if (!selectedOptions || typeof selectedOptions !== 'object') return null;

  const metaSource = selectedOptions.__meta__;
  const groups = [];

  const buildOptions = (options = []) => {
    return options
      .map((opt) => {
        if (!opt) return null;
        const optionId = opt.optionId ?? opt.id ?? opt.value ?? null;
        const name = opt.name || opt.label || opt.title || (optionId != null ? String(optionId) : 'Option');
        const priceCents = normalizePriceCents(
          opt.priceCents ?? opt.price_cents ?? (Number.isFinite(Number(opt.price)) ? Number(opt.price) * 100 : 0)
        );
        const quantity = Number.isFinite(Number(opt.quantity)) ? Math.max(1, Math.round(Number(opt.quantity))) : 1;
        return {
          optionId: optionId != null ? String(optionId) : null,
          name,
          priceCents,
          quantity,
        };
      })
      .filter(Boolean);
  };

  if (metaSource && typeof metaSource === 'object') {
    Object.entries(metaSource).forEach(([groupKey, groupMeta]) => {
      if (!groupMeta) return;
      const options = buildOptions(groupMeta.options);
      if (options.length) {
        groups.push({
          name: groupMeta.name || groupMeta.id || groupKey,
          options,
        });
      }
    });
  }

  if (groups.length) return groups;

  const fallback = [];
  Object.entries(selectedOptions).forEach(([groupKey, value]) => {
    if (groupKey.startsWith('__')) return;
    const options = buildOptions(Array.isArray(value) ? value : [value]);
    if (options.length) {
      fallback.push({
        name: groupKey,
        options,
      });
    }
  });

  return fallback.length ? fallback : null;
}

export const orderDbService = {
  async getSplitConfig() {
    // Read flag + threshold from DB; fall back to defaults if missing
    const [{ data: flagRow }, { data: settingRow }] = await Promise.all([
      supabase.from('feature_flags').select('enabled').eq('key', 'split_large_orders').maybeSingle(),
      supabase.from('app_settings').select('value').eq('key', 'split_threshold_cents').maybeSingle(),
    ]);
    const enabled = flagRow?.enabled ?? true;
    const thresholdCents = Number(settingRow?.value?.value ?? 25000);
    return { enabled, thresholdCents: Number.isFinite(thresholdCents) ? thresholdCents : 25000 };
  },

  async previewSplit(parentOrderId, thresholdCents = null) {
    const { data, error } = await supabase.rpc('split_order_simple', {
      p_parent_order_id: parentOrderId,
      p_threshold_cents: thresholdCents,
      p_preview: true,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },

  async applySplit(parentOrderId, thresholdCents = null) {
    const { data, error } = await supabase.rpc('split_order_simple', {
      p_parent_order_id: parentOrderId,
      p_threshold_cents: thresholdCents,
      p_preview: false,
    });
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  },
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
      total_amount:          quote?.total_with_tip_cents != null ? Number(quote.total_with_tip_cents) / 100 : null,
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

    const cartItems = cartSnapshot?.items || [];
    const cartItemIds = cartItems.map((item) => item?.id).filter(Boolean);

    const assignmentsMap = new Map();
    if (cartItemIds.length) {
      const { data: assignments, error: assErr } = await supabase
        .from('meal_cart_item_assignees')
        .select('cart_item_id, member_id, is_extra, unit_qty')
        .in('cart_item_id', cartItemIds);
      if (assErr) throw assErr;
      (assignments || []).forEach((row) => {
        const list = assignmentsMap.get(row.cart_item_id) || [];
        list.push(row);
        assignmentsMap.set(row.cart_item_id, list);
      });
    }

    const orderItemRows = [];
    const customizationPerRow = [];

    cartItems.forEach((item) => {
      const baseQuantity = Math.max(1, Number(item.quantity || 1));
      const basePriceCents = Math.round(Number(item.price || 0) * 100);
      const baseRow = {
        order_id: orderId,
        team_member_id: null,
        product_id: item.menu_item_id || item.menuItemId || item.product_id || item.id,
        name: item.item_name || item.name,
        description: item.description || null,
        image_url: item.image_url || null,
        notes: item.special_instructions
          || (typeof item.specialInstructions === 'string' ? item.specialInstructions : null)
          || item.notes
          || null,
        quantity: baseQuantity,
        product_marked_price_cents: basePriceCents,
        is_extra: false,
      };

      const groups = extractCustomizationsFromSelections(item?.selectedOptions || item?.selected_options);

      const assignments = assignmentsMap.get(item.id) || [];
      if (assignments.length) {
        let accounted = 0;
        assignments.forEach((assignment) => {
          const qty = Math.max(0, Number(assignment.unit_qty || 0));
          if (!qty) return;
          accounted += qty;
          orderItemRows.push({
            ...baseRow,
            team_member_id: assignment.is_extra ? null : assignment.member_id,
            quantity: qty,
            is_extra: Boolean(assignment.is_extra),
          });
          customizationPerRow.push(groups);
        });

        const residual = Math.max(0, baseQuantity - accounted);
        if (residual > 0) {
          orderItemRows.push({
            ...baseRow,
            team_member_id: null,
            quantity: residual,
            is_extra: false,
          });
          customizationPerRow.push(groups);
        }
      } else {
        orderItemRows.push({ ...baseRow, is_extra: false });
        customizationPerRow.push(groups);
      }
    });

    if (orderItemRows.length) {
      const { data: insertedItems, error: itemsErr } = await supabase
        .from('meal_order_items')
        .insert(orderItemRows)
        .select('id');
      if (itemsErr) throw itemsErr;

      const customizationRows = [];
      const optionGroups = [];

      (insertedItems || []).forEach((row, idx) => {
        const groups = customizationPerRow[idx];
        if (!groups) return;
        groups.forEach((group) => {
          if (!group?.options?.length) return;
          customizationRows.push({
            order_item_id: row.id,
            name: group.name || 'Customization',
          });
          optionGroups.push(group.options);
        });
      });

      if (customizationRows.length) {
        const { data: insertedCustomizations, error: custErr } = await supabase
          .from('meal_order_item_customizations')
          .insert(customizationRows)
          .select('id');
        if (custErr) throw custErr;

        const optionRows = [];
        (insertedCustomizations || []).forEach((cust, idx) => {
          const opts = optionGroups[idx] || [];
          opts.forEach((opt) => {
            optionRows.push({
              customization_id: cust.id,
              option_id: opt.optionId ? String(opt.optionId) : null,
              name: opt.name || 'Option',
              price_cents: normalizePriceCents(opt.priceCents),
              quantity: Number.isFinite(Number(opt.quantity)) && Number(opt.quantity) > 0
                ? Math.round(Number(opt.quantity))
                : 1,
            });
          });
        });

        if (optionRows.length) {
          const { error: optErr } = await supabase
            .from('meal_order_item_options')
            .insert(optionRows);
          if (optErr) throw optErr;
        }
      }
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

  async markScheduled(localOrderId, extra = {}) {
    const { error } = await supabase
      .from('meal_orders')
      .update({ order_status: 'scheduled', order_placed: true, ...extra })
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
