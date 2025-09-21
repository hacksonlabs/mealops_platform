// server/providers/manual/adapter.ts
import type { ProviderAdapter } from '../../providers/ProviderAdapter';
import type { OrderDraft, Quote, PlaceResult } from '../../../src/domain/orderTypes';

export const manualAdapter: ProviderAdapter = {
  name: 'manual',
  supportsCancel: true,

  async quote(draft: OrderDraft): Promise<Quote> {
    const subtotal = draft.items.reduce((sum, it) => {
      const base = it.basePriceCents ?? 0;
      const opts = (it.options ?? []).reduce((s, o) => s + (o.priceCents ?? 0) * (o.quantity ?? 1), 0);
      return sum + (base + opts) * it.quantity;
    }, 0);
    const fees = { service_fee: Math.round(subtotal * 0.03) };
    const tax  = Math.round(subtotal * 0.08);
    const tip  = (draft.fulfillment.method === 'delivery' ? (draft.tips.driverTipCents ?? 0) : (draft.tips.pickupTipCents ?? 0));
    const total = subtotal + Object.values(fees).reduce((a,b)=>a+b,0) + tax + tip;

    return { provider: 'manual', subtotalCents: subtotal, feesCents: fees, taxCents: tax, tipCents: tip, totalCents: total, raw: { calc: 'manual' } };
  },

  async place(draft: OrderDraft, quote?: Quote): Promise<PlaceResult> {
    return {
      providerOrderId: `MAN-${draft.id.slice(0,8)}-${Date.now()}`,
      status: 'pending_confirmation',
      trackingUrl: undefined,
      raw: { quoted: Boolean(quote) }
    };
  },

  async cancel(_providerOrderId: string) {
    // pretend provider cancels instantly
    return 'immediate_cancelled';
  }
};
