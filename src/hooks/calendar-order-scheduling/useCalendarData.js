// /src/hooks/calendar-order-scheduling/useCalendarData
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRangeForView, fmtTime, mkBirthdayDateForYear } from '@/utils/calendarUtils';
function _locationDisplayFromOrder(row) {
  const deliveryAddress = row?.delivery_address_line1
    ? [
        row.delivery_address_line1 + (row.delivery_address_line2 ? ` ${row.delivery_address_line2}` : ''),
        [row.delivery_city, row.delivery_state, row.delivery_zip].filter(Boolean).join(', ')
      ]
        .filter(Boolean)
        .join(' • ')
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

  // ---- compute union window using primitives (ms/ISO) ----
  const { startMs, endMs } = useMemo(() => {
    const { start, end } = getRangeForView(currentDate, viewMode);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [currentDate, viewMode]);
  const todayMs = useMemo(() => {
    const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
  }, []);
  const next7Ms = useMemo(() => todayMs + 7 * 24 * 60 * 60 * 1000, [todayMs]);
  const unionStartMs = Math.min(startMs, todayMs);
  const unionEndMs   = Math.max(endMs,   next7Ms);
  const unionStartISO = useMemo(() => new Date(unionStartMs).toISOString(), [unionStartMs]);
  const unionEndISO   = useMemo(() => new Date(unionEndMs).toISOString(),   [unionEndMs]);

  // ------- TEAM MEMBERS: fetch once per team -------
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
          id: m.id,
          name: m.full_name,
          role: m.role,
          email: m.email,
          allergies: m.allergies || null,
          birthday: m.birthday || null,
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

  // ------- ORDERS: single query for union window -------
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
        const mappedOrders = (orderRows || []).map((row) => {
          // Deduplicate attendees by team_member id; fallback to quantity sum.
          const unique = new Map();
          (row.meal_items || []).forEach((it, idx) => {
            const tm = it?.team_member;
            const key = tm?.id ?? `item-${idx}`;
            if (!unique.has(key) && tm?.full_name) {
              unique.set(key, { name: tm.full_name, role: tm.role || '' });
            }
          });
          const team_members = Array.from(unique.values());
          const attendeeCount =
            team_members.length ||
            (row.meal_items || []).reduce((sum, it) => sum + (Number(it?.quantity) || 0), 0);
          const mealType = row.meal_type || inferMealTypeFromText(row.title, row.description);
          const detailPayload = {
            id: row.id,
            title: row.title || '',
            restaurant: row.restaurant?.name || 'Unknown Restaurant',
            date: row.scheduled_date, // use ISO string
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
            date: row.scheduled_date, // use ISO string
            time: fmtTime(row.scheduled_date),
            restaurant: row.restaurant?.name || 'Unknown Restaurant',
            mealType,
            attendees: attendeeCount,
            status: row.order_status,
            notes: row.description ?? '',
            originalOrderData: detailPayload,
          };
        });
        if (!cancelled) setOrders(mappedOrders);
      } catch (e) {
        if (!cancelled) {
          console.error('useCalendarData error:', e);
          setErr(e?.message || 'Failed to load calendar data');
          setOrders([]);
        }
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId, unionStartISO, unionEndISO]);

  // ------- BIRTHDAYS derived locally for the same union window -------
  useEffect(() => {
    const start = new Date(unionStartMs); 
    const end = new Date(unionEndMs);
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
  }, [teamMembers, unionStartMs, unionEndMs]);

  // ------- Upcoming (NOW → +7) derived from the same orders -------
  const upcomingNow = useMemo(() => {
    const todayISO = new Date(todayMs).toISOString();
    const nextISO  = new Date(next7Ms).toISOString();
    return (orders || [])
      .filter(o =>
        o.type === 'order' &&
        o.date >= todayISO &&
        o.date <= nextISO &&
        String(o.status).toLowerCase() !== 'completed'
      )
      .sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [orders, todayMs, next7Ms]);

  const loading = loadingOrders || loadingMembers;
  return { loading, error, orders, teamMembers, birthdayEvents, upcomingNow };
}
export default useCalendarData;