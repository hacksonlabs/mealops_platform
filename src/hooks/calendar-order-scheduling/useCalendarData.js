// /src/hooks/calendar-order-scheduling/useCalendarData.js
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getRangeForView, fmtTime, mkBirthdayDateForYear } from '@/utils/calendarUtils';

// Reuse your helpers
function _locationDisplayFromOrder(row) {
  const deliveryAddress = row?.delivery_address_line1
    ? [
        row.delivery_address_line1 + (row.delivery_address_line2 ? ` ${row.delivery_address_line2}` : ''),
        [row.delivery_city, row.delivery_state, row.delivery_zip].filter(Boolean).join(', ')
      ].filter(Boolean).join(' • ')
    : null;
  return row?.fulfillment_method === 'delivery'
    ? (deliveryAddress || 'Delivery address TBD')
    : (row?.restaurant?.address || 'Restaurant address TBD');
}

function inferMealTypeFromText(title, description) {
  const hay = `${title ?? ''} ${description ?? ''}`;
  if (/\bbreakfast\b/i.test(hay)) return 'breakfast';
  if (/\blunch\b/i.test(hay)) return 'lunch';
  if (/\bdinner\b/i.test(hay)) return 'dinner';
  if (/\bsnacks?\b/i.test(hay)) return 'snack';
  return 'other';
}

export function useCalendarData(activeTeamId, currentDate, viewMode) {
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setErr] = useState('');
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdayEvents, setBirthdayEvents] = useState([]);

  // ---- compute union window (use primitives, not Date objects)
  const { startMs, endMs } = useMemo(() => {
    const { start, end } = getRangeForView(currentDate, viewMode);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [currentDate, viewMode]);

  const todayMs = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const next7Ms  = useMemo(() => todayMs + 7*24*60*60*1000, [todayMs]);
  const unionStartISO = useMemo(() => new Date(Math.min(startMs, todayMs)).toISOString(), [startMs, todayMs]);
  const unionEndISO   = useMemo(() => new Date(Math.max(endMs,   next7Ms)).toISOString(), [endMs, next7Ms]);

  // ------- TEAM MEMBERS (once per team) -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr('');
      if (!activeTeamId) { if (!cancelled) setTeamMembers([]); return; }
      setLoadingMembers(true);
      try {
        const { data: memberRows, error: membersErr } = await supabase
          .from('team_members')
          .select('id, user_id, full_name, role, email, allergies, birthday')
          .eq('team_id', activeTeamId);
        if (membersErr) throw membersErr;
        const simplified = (memberRows ?? []).map((m) => ({
          id: m.id, name: m.full_name, role: m.role, email: m.email,
          allergies: m.allergies || null, birthday: m.birthday || null,
        }));
        if (!cancelled) setTeamMembers(simplified);
      } catch (e) {
        if (!cancelled) { setErr(e?.message || 'Failed to load team members'); setTeamMembers([]); }
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId]);

  // ------- ORDERS (single query for union window) -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr('');
      if (!activeTeamId) { if (!cancelled) setOrders([]); return; }
      setLoadingOrders(true);
      try {
        const { data: orderRows, error: orderErr } = await supabase
          .from('meal_orders')
          .select(`
            id, team_id, title, description, meal_type, scheduled_date,
            order_status, fulfillment_method, delivery_instructions, created_at,
            delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
            restaurant:restaurants ( id, name, address ),
            meal_items:meal_order_items (
              id, name, quantity, product_marked_price_cents, notes,
              team_member:team_members ( id, full_name, role )
            )
          `)
          .eq('team_id', activeTeamId)
          .gte('scheduled_date', unionStartISO)
          .lte('scheduled_date', unionEndISO)
          .order('scheduled_date', { ascending: true });
        if (orderErr) throw orderErr;

        const mapped = (orderRows || []).map((row) => {
          const uniq = new Map();
          (row.meal_items || []).forEach((it, idx) => {
            const tm = it?.team_member;
            const key = tm?.id ?? `item-${idx}`;
            if (!uniq.has(key) && tm?.full_name) {
              uniq.set(key, { name: tm.full_name, role: tm.role || '' });
            }
          });
          const team_members = Array.from(uniq.values());
          const attendeeCount =
            team_members.length ||
            (row.meal_items || []).reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
          const mealType = row.meal_type || inferMealTypeFromText(row.title, row.description);

          const detailPayload = {
            id: row.id,
            title: row.title || '',
            restaurant: row.restaurant?.name || 'Unknown Restaurant',
            date: row.scheduled_date,
            time: fmtTime(row.scheduled_date),
            mealType,
            status: row.order_status,
            created_at: row.created_at,
            fulfillment_method: row.fulfillment_method || '',
            location_display: _locationDisplayFromOrder(row),
            delivery_instructions: row.delivery_instructions || '',
            team_members,
          };

          return {
            id: row.id,
            type: 'order',
            date: row.scheduled_date,
            time: fmtTime(row.scheduled_date),
            restaurant: row.restaurant?.name || 'Unknown Restaurant',
            mealType,
            attendees: attendeeCount,
            status: row.order_status,
            notes: row.description ?? '',
            originalOrderData: detailPayload,
          };
        });

        if (!cancelled) setOrders(mapped);
      } catch (e) {
        if (!cancelled) { setErr(e?.message || 'Failed to load calendar data'); setOrders([]); }
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId, unionStartISO, unionEndISO]);

  // ------- BIRTHDAYS (derived) -------
  useEffect(() => {
    const start = new Date(unionStartISO);
    const end   = new Date(unionEndISO);
    const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
    const bdays = [];
    (teamMembers || []).forEach((m) => {
      if (!m.birthday) return;
      years.forEach((yr) => {
        const d = mkBirthdayDateForYear(m.birthday, yr);
        if (d >= start && d <= end) {
          bdays.push({
            id: `bday-${m.id}-${yr}`,
            type: 'birthday',
            date: d.toISOString(),
            label: `${m.name}'s Bday!`,
            memberId: m.id,
            memberName: m.name,
            dob: m.birthday,
            status: 'birthday',
          });
        }
      });
    });
    setBirthdayEvents(bdays);
  }, [teamMembers, unionStartISO, unionEndISO]);

  // ------- Upcoming (NOW → +7) from the same orders -------
  const upcomingNow = useMemo(() => {
    const todayISO = new Date(todayMs).toISOString();
    const nextISO  = new Date(next7Ms).toISOString();
    return (orders || [])
      .filter(o => o.type === 'order' &&
        o.date >= todayISO && o.date <= nextISO &&
        String(o.status).toLowerCase() !== 'completed')
      .sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [orders, todayMs, next7Ms]);

  // ------- Order-detail fetcher with in-memory cache -------
  const detailCache = useRef(new Map()); // id -> shaped detail

  const getOrderDetail = useCallback(async (orderId) => {
    if (!orderId || !activeTeamId) return null;
    if (detailCache.current.has(orderId)) {
      return detailCache.current.get(orderId);
    }

    const { data, error } = await supabase
      .from('meal_orders')
      .select(`
        id, team_id, title, description, meal_type, scheduled_date, created_at,
        order_status, total_amount, api_order_id, fulfillment_method,
        delivery_instructions,
        delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        subtotal_cents, total_without_tips_cents, total_with_tip_cents, sales_tax_cents, service_fee_cents, delivery_fee_cents,
        restaurant:restaurants!meal_orders_restaurant_id_fkey ( id, name, address ),
        payment_method:payment_methods ( id, card_name, last_four, is_default ),
        items:meal_order_items (
          id, team_member_id, product_id, name, description, image_url, notes,
          quantity, product_marked_price_cents, created_at,
          team_member:team_members ( id, full_name, role ),
          customizations:meal_order_item_customizations (
            id, name,
            options:meal_order_item_options ( option_id, name, price_cents, quantity, metadata )
          )
        )
      `)
      .eq('team_id', activeTeamId)
      .eq('id', orderId)
      .single();

    if (error) throw error;

    const deliveryAddress = data?.delivery_address_line1
      ? [
          data.delivery_address_line1 + (data.delivery_address_line2 ? ` ${data.delivery_address_line2}` : ''),
          [data.delivery_city, data.delivery_state, data.delivery_zip].filter(Boolean).join(', ')
        ].filter(Boolean).join(' • ')
      : null;

    const locationDisplay =
      data?.fulfillment_method === 'delivery'
        ? (deliveryAddress || 'Delivery address TBD')
        : (data?.restaurant?.address || 'Restaurant address TBD');

    const shaped = {
      ...data,
      restaurantName: data?.restaurant?.name ?? null,
      restaurantAddress: data?.restaurant?.address ?? null,
      fulfillment_method: data?.fulfillment_method ?? null,
      locationDisplay,
      orderItems: (data?.items || []).map((it) => ({
        id: it.id,
        name: it.name,
        notes: it.notes || null,
        quantity: it.quantity || 0,
        unitPriceCents: it.product_marked_price_cents ?? null,
        member: it.team_member
          ? { id: it.team_member.id, name: it.team_member.full_name, role: it.team_member.role || '' }
          : null,
        customizations: (it.customizations || []).map((c) => ({
          id: c.id,
          name: c.name,
          options: (c.options || []).map((o) => ({
            optionId: o.option_id,
            name: o.name,
            priceCents: o.price_cents ?? 0,
            quantity: o.quantity ?? 1,
            metadata: o.metadata ?? {},
          })),
        })),
      })),
    };

    detailCache.current.set(orderId, shaped);
    return shaped;
  }, [activeTeamId]);

  const loading = loadingOrders || loadingMembers;
  return { loading, error, orders, teamMembers, birthdayEvents, upcomingNow, getOrderDetail };
}
export default useCalendarData;