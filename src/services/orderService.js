// src/services/orderService.js

const ORDERS_MOCK = (import.meta?.env?.VITE_ORDERS_MOCK ?? '1') === '1';

/**
 * Unified shape:
 * - createDraft(orderInput) -> { orderId, quote: { ...totals } }
 * - finalize(orderId)       -> { orderId, status }
 *
 * "orderInput" mirrors MealMe's Create Order payload.
 */

// -------- MealMe adapter (REAL; behind your proxy) ----------
const mealmeAdapter = {
  async createDraft(orderInput) {
    // Your backend should proxy to https://api.mealme.ai/order/order/v4
    // with place_order:false and include_final_quote:true
    const res = await fetch('/api/mealme/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...orderInput,
        place_order: false,
        include_final_quote: true,
      }),
    });
    if (!res.ok) throw new Error('MealMe: failed to create order');
    const json = await res.json();
    return {
      orderId: json.order_id,
      quote: json.final_quote || json.quote || null,
    };
  },

  async finalize(orderId) {
    // Your backend should proxy to https://api.mealme.ai/order/finalize
    const res = await fetch('/api/mealme/finalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId }),
    });
    if (!res.ok) throw new Error('MealMe: failed to finalize order');
    const json = await res.json();
    return { orderId: json.order_id, status: json.status || 'placed' };
  },
};

// -------- Mock adapter (DEV) ----------
const mockAdapter = {
  async createDraft(orderInput) {
    // Simulate totals from the cart/orderInput
    const fakeOrderId = `ord_mock_${Math.random().toString(36).slice(2, 10)}`;
    const items = Array.isArray(orderInput?.items) ? orderInput.items : [];

    const subtotalCents = items.reduce((sum, it) => {
      // if you store price on items, you can pass it as 'price_cents' in your orderInput for better mocks
      const price = Number(it.price_cents ?? 1299); // default 12.99
      const qty = Math.max(1, Number(it.quantity ?? 1));
      return sum + price * qty;
    }, 0);

    const deliveryFeeCents = orderInput?.pickup ? 0 : 299;
    const taxCents = Math.round(subtotalCents * 0.08);
    const tipCents = orderInput?.pickup
      ? Number(orderInput?.pickup_tip_cents ?? 0)
      : Number(orderInput?.driver_tip_cents ?? 0);

    const totalCents = subtotalCents + deliveryFeeCents + taxCents + tipCents;

    return {
      orderId: fakeOrderId,
      quote: {
        subtotal_cents: subtotalCents,
        fees_cents: deliveryFeeCents,
        tax_cents: taxCents,
        tip_cents: tipCents,
        total_with_tip_cents: totalCents,
      },
    };
  },

  async finalize(orderId) {
    // Pretend the marketplace placed it
    await new Promise((r) => setTimeout(r, 350));
    return { orderId, status: 'placed' };
  },
};

// -------- Public API -----------
const adapter = ORDERS_MOCK ? mockAdapter : mealmeAdapter;

export const orderService = {
  createDraft: (orderInput) => adapter.createDraft(orderInput),
  finalize: (orderId) => adapter.finalize(orderId),
};
