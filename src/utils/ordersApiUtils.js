// Works with or without a backend.
// If VITE_API_BASE_URL is set, we try HTTP first; otherwise we update via Supabase.

import { supabase } from '@/lib/supabase';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')
  : '';

export async function callCancelAPI(orderId, reason = '') {
  // Try real API only if its explicitly configured
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason }),
      });
      if (res.ok) return { ok: true, source: 'http' };

      // Let it fall through to Supabase if the API returns an error
      console.warn(`Cancel API returned ${res.status}; falling back to Supabase.`);
    } catch (e) {
      console.warn('Cancel API not reachable; falling back to Supabase.', e);
    }
  }

  // Fallback: direct DB update (coach/admin/creator can pass RLS)
  const { data, error } = await supabase
    .from('meal_orders')
    .update({ order_status: 'cancelled' })
    .eq('id', orderId)
    .select('id, order_status')
    .single();

  if (error) {
    throw new Error(`Cancel failed via Supabase: ${error.message}`);
  }
  return { ok: true, source: 'supabase', data };
}
