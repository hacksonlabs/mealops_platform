// server/workers/cancelOrder.ts
import type { CancelResult } from '../../src/domain/orderTypes';
import type { ProviderAdapter } from '../providers/ProviderAdapter';
import { supabaseService } from '../lib/supabaseService';
// import adapters via getAdapter for multiple
import { manualAdapter } from '../providers/manual/adapter';

const adapters: Record<string, ProviderAdapter> = {
  manual: manualAdapter,
  // ubereats: uberAdapter, 
  // grubhub: grubhubAdapter,
  // mealme: mealmeAdapter
};

export async function cancelOrderWorker(orderId: string) {
  const { data: o, error } = await supabaseService
    .from('meal_orders')
    .select('id, api_source, api_order_id, cancel_reason')
    .eq('id', orderId)
    .single();
  if (error || !o) return;

  const adapter = o.api_source ? adapters[o.api_source] : undefined;
  if (!adapter || !adapter.supportsCancel) {
    await supabaseService.from('order_events').insert({
      order_id: orderId, type: 'cancel_requested',
      payload: { provider: o.api_source, supported: false, queued: true }
    });
    return;
  }

  const result: CancelResult = await adapter.cancel(o.api_order_id!, o.cancel_reason ?? undefined);

  if (result === 'immediate_cancelled') {
    await supabaseService.rpc('finalize_order_cancellation', {
      p_order_id: orderId, p_success: true, p_message: 'Provider cancelled immediately', p_payload: {}
    });
  } else if (result === 'accepted') {
    await supabaseService.from('order_events').insert({
      order_id: orderId, type: 'cancel_requested',
      payload: { provider: o.api_source, accepted: true }
    });
  } else if (result === 'denied') {
    await supabaseService.rpc('finalize_order_cancellation', {
      p_order_id: orderId, p_success: false, p_message: 'Provider denied cancellation', p_payload: {}
    });
  }
}

