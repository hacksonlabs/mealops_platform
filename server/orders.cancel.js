// server/orders.cancel.js (Express)
import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service key: bypasses RLS
);

router.post('/api/orders/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { reason = '' } = req.body || {};

  try {
    // load order
    const { data: order, error: fetchErr } = await supabase
      .from('meal_orders')
      .select('id, team_id, order_status')
      .eq('id', id)
      .single();

    if (fetchErr) {
      console.error('fetchErr', fetchErr);
      return res.status(500).json({ message: 'Database error loading order' });
    }
    if (!order) return res.status(404).json({ message: 'Order not found' });

    // guard rails
    if (order.order_status === 'cancelled') {
      return res.status(409).json({ message: 'Order already cancelled' });
    }

    // (optional) add your cutoff logic here; return 422 if past window

    // update
    const { error: updErr } = await supabase
      .from('meal_orders')
      .update({
        order_status: 'cancelled',
        cancel_reason: reason || null,
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updErr) {
      console.error('updErr', updErr);
      return res.status(500).json({ message: 'Database error updating order' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('Unhandled cancel error', e);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

export default router;