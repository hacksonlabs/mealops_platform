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
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState('');
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdayEvents, setBirthdayEvents] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr('');
      if (!activeTeamId) {
        setOrders([]); setTeamMembers([]); setBirthdayEvents([]);
        return;
      }
      setLoading(true);
      try {
        const { start, end } = getRangeForView(currentDate, viewMode);
        // ------- ORDERS (meal_orders + meal_order_items) -------
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
          .gte('scheduled_date', start.toISOString())
          .lte('scheduled_date', end.toISOString())
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
        // ------- TEAM MEMBERS (for modal + birthdays) -------
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
        // ------- BIRTHDAYS IN RANGE -------
        const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
        const bdays = [];
        simplified.forEach((m) => {
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
        if (!cancelled) setBirthdayEvents(bdays);
      } catch (e) {
        if (!cancelled) {
          console.error('useCalendarData error:', e);
          setErr(e?.message || 'Failed to load calendar data');
          setOrders([]); setTeamMembers([]); setBirthdayEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId, currentDate, viewMode]);
  return { loading, error, orders, teamMembers, birthdayEvents };
}
export default useCalendarData;