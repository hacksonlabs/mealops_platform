// src/pages/calendar-order-scheduling/hooks/useCalendarData.js
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getRangeForView, fmtTime, mkBirthdayDateForYear } from '@/utils/calendarUtils';

export default function useCalendarData(activeTeamId, currentDate, viewMode) {
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState('');
  const [orders, setOrders] = useState([]);           // normalized order events
  const [teamMembers, setTeamMembers] = useState([]); // minimal fields
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

        // Orders in range
        const { data: orderRows, error: orderErr } = await supabase
          .from('meal_orders')
          .select(`
            id, team_id, title, description, meal_type, scheduled_date,
            order_status, fulfillment_method, delivery_instructions, created_at,
            restaurants:restaurants ( id, name ),
            order_items:order_items (
              id, user_id, team_member_id,
              user_profiles:user_profiles ( first_name, last_name ),
              team_members:team_members ( full_name, role )
            )
          `)
          .eq('team_id', activeTeamId)
          .gte('scheduled_date', start.toISOString())
          .lte('scheduled_date', end.toISOString())
          .order('scheduled_date', { ascending: true });

        if (orderErr) throw orderErr;

        const mappedOrders = (orderRows || []).map((row) => {
          // Unique attendees
          const unique = new Map();
          (row.order_items || []).forEach((it) => {
            const key = it.team_member_id || it.user_id || it.id;
            if (unique.has(key)) return;
            const name =
              it.team_members?.full_name ??
              (it.user_profiles ? `${it.user_profiles.first_name} ${it.user_profiles.last_name}` : 'Team Member');
            const role = it.team_members?.role || '';
            unique.set(key, { name, role });
          });
          const team_members = Array.from(unique.values());

          const mealType =
            row.meal_type ||
            (/\bbreakfast\b/i.test(`${row.title ?? ''} ${row.description ?? ''}`)
              ? 'breakfast'
              : /\blunch\b/i.test(`${row.title ?? ''} ${row.description ?? ''}`)
              ? 'lunch'
              : /\bdinner\b/i.test(`${row.title ?? ''} ${row.description ?? ''}`)
              ? 'dinner'
              : /\bsnacks?\b/i.test(`${row.title ?? ''} ${row.description ?? ''}`)
              ? 'snack'
              : 'other');

          const detailPayload = {
            id: row.id,
            title: row.title || '',
            restaurant: row.restaurants?.name || 'Unknown Restaurant',
            date: row.scheduled_date,
            time: fmtTime(row.scheduled_date),
            mealType,
            status: row.order_status,
            created_at: row.created_at,
            fulfillment_method: row.fulfillment_method || '',
            delivery_instructions: row.delivery_instructions || '',
            team_members,
          };

          return {
            id: row.id,
            type: 'order',
            date: row.scheduled_date,
            time: fmtTime(row.scheduled_date),
            restaurant: row.restaurants?.name || 'Unknown Restaurant',
            mealType,
            attendees: team_members.length,
            status: row.order_status,
            notes: row.description ?? '',
            originalOrderData: detailPayload,
          };
        });

        if (!cancelled) setOrders(mappedOrders);

        // Team members (no is_active filtering)
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

        // Birthdays within range
        const years = new Set([start.getFullYear(), end.getFullYear()]);
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
          setOrders([]);
          setTeamMembers([]);
          setBirthdayEvents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeTeamId, currentDate, viewMode]);

  return { loading, error, orders, teamMembers, birthdayEvents };
}
