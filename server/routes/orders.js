// server/routes/orders.ts (pseudo/Express)
import { createClient } from '@supabase/supabase-js';
import { manualAdapter } from '../providers/manual/adapter';
import { adapters } from '../providers'; // e.g. { doordash, ubereats, manual }

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    // Load order (service role to avoid client-RLS flakiness) OR do this with RLS and user JWT
    const { data: order, error } = await supabase
      .from('meal_orders')
      .select('id, team_id, order_status, api_source, api_order_id')
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ error: 'Order not found' });
    if (order.order_status === 'cancelled') return res.json({ ok: true, status: 'cancelled' });

    const providerKey = order.api_source || 'manual';
    const adapter = adapters[providerKey] || manualAdapter;

    // Only call the provider if we have a provider order id
    if (adapter.supportsCancel && order.api_order_id) {
      await adapter.cancel(order.api_order_id);
    }

    const { error: updErr } = await supabase
      .from('meal_orders')
      .update({ order_status: 'cancelled' })
      .eq('id', id);

    if (updErr) return res.status(400).json({ error: updErr.message });

    return res.json({ ok: true, status: 'cancelled' });
  } catch (e) {
    console.error('Cancel failed:', e);
    return res.status(500).json({ error: e?.message || 'Internal Server Error' });
  }
});