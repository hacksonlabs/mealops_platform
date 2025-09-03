// server/services/mappers.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { OrderDraft } from '../../src/domain/orderTypes';

export async function toOrderDraft(supa: SupabaseClient, orderId: string): Promise<OrderDraft> {
  const { data: order, error } = await supa
    .from('meal_orders')
    .select(`
      id, team_id, currency_code, scheduled_date, fulfillment_method,
      delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip, delivery_instructions,
      driver_tip_cents, pickup_tip_cents,
      restaurants:restaurants ( name, address, api_id, api_source ),
      meal_order_items (
        id, name, quantity, product_marked_price_cents, notes,
        meal_order_item_customizations (
          meal_order_item_options ( name, quantity, price_cents )
        )
      )
    `)
    .eq('id', orderId)
    .single();

  if (error || !order) throw new Error(error?.message || 'Order not found');

  const items = (order.meal_order_items ?? []).map((i: any) => ({
    id: i.id,
    name: i.name,
    quantity: i.quantity ?? 1,
    basePriceCents: i.product_marked_price_cents ?? undefined,
    notes: i.notes ?? null,
    options: (i.meal_order_item_customizations ?? []).flatMap((c: any) =>
      (c.meal_order_item_options ?? []).map((o: any) => ({
        name: o.name, quantity: o.quantity ?? 1, priceCents: o.price_cents ?? 0
      }))
    ),
  }));

  function asOne<T>(rel: T | T[] | null | undefined): T | null {
    return Array.isArray(rel) ? (rel[0] ?? null) : (rel ?? null);
  }

  const r = asOne(order.restaurants);

  const draft: OrderDraft = {
    id: order.id,
    teamId: order.team_id,
    currency: (order.currency_code ?? 'USD') as 'USD',
    restaurant: {
      providerStoreId: r?.api_id ?? null,
      name: r?.name ?? 'Restaurant',
      address: r?.address ?? null,
    },
    fulfillment: {
      method: (order.fulfillment_method ?? 'delivery'),
      whenISO: order.scheduled_date,
      address: order.fulfillment_method === 'delivery' ? {
        line1: order.delivery_address_line1,
        line2: order.delivery_address_line2,
        city:  order.delivery_city,
        state: order.delivery_state,
        zip:   order.delivery_zip,
        instructions: order.delivery_instructions,
      } : undefined
    },
    items,
    tips: {
      driverTipCents: order.driver_tip_cents ?? undefined,
      pickupTipCents: order.pickup_tip_cents ?? undefined,
    },
  };

  return draft;
}
