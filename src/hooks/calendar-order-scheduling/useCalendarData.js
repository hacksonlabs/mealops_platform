// /src/hooks/calendar-order-scheduling/useCalendarData.js
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getRangeForView, fmtTime, mkBirthdayDateForYear, computeAge, toE164US } from '@/utils/calendarUtils';

// helper: make ISO from date (DATE) + time (TIME)
function isoFromPgDateTime(pgDate, pgTime) {
  if (!pgDate) return null;            // unscheduled cart -> keep off calendar
  const date = typeof pgDate === 'string' ? pgDate : pgDate.toISOString().slice(0,10);
  const time = pgTime ? String(pgTime).slice(0,8) : '12:00:00'; // midday default if time missing
  const isoLocal = `${date}T${time}`;
  const d = new Date(isoLocal);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

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

/**
 * @param {string|null} activeTeamId
 * @param {Date} currentDate
 * @param {'twoWeeks'|'month'} viewMode
 * @param {object} currentUser  // pass user from useAuth(); used by remindCoaches filtering
 */
export function useCalendarData(
  activeTeamId,
  currentDate,
  viewMode,
  currentUser = null,
  options = {}
) {
  const {
    futureDaysBuffer = 7,
    pastDaysBuffer = 0,
  } = options;
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setErr] = useState('');
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdayEvents, setBirthdayEvents] = useState([]);
  const [carts, setCarts] = useState([]);

  // ---- union time window (stable primitives to avoid re-renders) ----
  const { startMs, endMs } = useMemo(() => {
    const { start, end } = getRangeForView(currentDate, viewMode);
    return { startMs: start.getTime(), endMs: end.getTime() };
  }, [currentDate, viewMode]);

  const todayMs = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const bufferFutureMs = useMemo(
    () => todayMs + futureDaysBuffer * 24 * 60 * 60 * 1000,
    [todayMs, futureDaysBuffer]
  );
  const bufferPastMs = useMemo(
    () => todayMs - Math.abs(pastDaysBuffer) * 24 * 60 * 60 * 1000,
    [todayMs, pastDaysBuffer]
  );
  const unionStartISO = useMemo(
    () => new Date(Math.min(startMs, bufferPastMs)).toISOString(),
    [startMs, bufferPastMs]
  );
  const unionEndISO   = useMemo(
    () => new Date(Math.max(endMs, bufferFutureMs)).toISOString(),
    [endMs, bufferFutureMs]
  );

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
          .select('id, user_id, full_name, role, email, allergies, birthday, phone_number')
          .eq('team_id', activeTeamId);
        if (membersErr) throw membersErr;
        const simplified = (memberRows ?? []).map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: m.full_name,
          role: m.role,
          email: m.email,
          phone_number: m.phone_number || null,
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
            api_order_id,
            delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
            restaurant:restaurants ( id, name, address ),
            meal_items:meal_order_items (
              id, name, quantity, product_marked_price_cents, notes,
              is_extra,
              team_member_id,
              team_member:team_members ( id, full_name, role )
            ),
            child_splits:meal_order_splits!meal_order_splits_parent_order_id_fkey (
              child_order:child_order_id (
                id,
                api_order_id,
                scheduled_date,
                title,
                restaurant:restaurants ( id, name )
              )
            )
          `)
          .eq('team_id', activeTeamId)
          .is('parent_order_id', null)  // -- do not show suborders (only parents)
          .gte('scheduled_date', unionStartISO)
          .lte('scheduled_date', unionEndISO)
          .order('scheduled_date', { ascending: true });
        if (orderErr) throw orderErr;

        const mapped = (orderRows || []).map((row) => {
          const memberMap = new Map();
          let extrasCount = 0;
          let unassignedCount = 0;
          let totalMeals = 0;

          (row.meal_items || []).forEach((it, idx) => {
            const qty = Math.max(1, Number(it?.quantity ?? 1));
            totalMeals += qty;
            if (it?.is_extra) {
              extrasCount += qty;
              return;
            }
            const tm = it?.team_member;
            if (tm?.full_name) {
              const key = tm.id ?? `member-${idx}`;
              const entry = memberMap.get(key) || { name: tm.full_name, role: tm.role || '', count: 0 };
              entry.count += qty;
              memberMap.set(key, entry);
            } else {
              unassignedCount += qty;
            }
          });

          const team_members = Array.from(memberMap.values());
          const attendeeCount = team_members.reduce((sum, entry) => sum + entry.count, 0) + extrasCount + unassignedCount || totalMeals;
          const attendeeDescriptionParts = [];
          if (extrasCount > 0) attendeeDescriptionParts.push(`${extrasCount} extra${extrasCount === 1 ? '' : 's'}`);
          if (unassignedCount > 0) attendeeDescriptionParts.push(`${unassignedCount} unassigned`);
          const attendeeDescription = attendeeDescriptionParts.join(' • ');
          const mealType = row.meal_type || inferMealTypeFromText(row.title, row.description);

          const childOrdersRaw = Array.isArray(row.child_splits) ? row.child_splits : [];
          const childOrders = childOrdersRaw
            .map((split) => {
              const child = split?.child_order;
              if (!child?.id) return null;
              const orderNumber = child.api_order_id || `ORD-${String(child.id).substring(0, 8)}`;
              const partMatch = child.title ? child.title.match(/Part\s+(\d+)/i) : null;
              const partIndex = partMatch ? Number(partMatch[1]) : null;
              return {
                id: child.id,
                orderNumber,
                scheduledDate: child.scheduled_date,
                restaurant: child.restaurant?.name || row.restaurant?.name || 'Unknown Restaurant',
                title: child.title || '',
                partIndex,
              };
            })
            .filter(Boolean)
            .sort((a, b) => {
              const ai = Number.isFinite(a.partIndex) ? a.partIndex : Number.MAX_SAFE_INTEGER;
              const bi = Number.isFinite(b.partIndex) ? b.partIndex : Number.MAX_SAFE_INTEGER;
              if (ai !== bi) return ai - bi;
              return String(a.orderNumber).localeCompare(String(b.orderNumber));
            });

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
            extrasCount,
            unassignedCount,
            attendeesTotal: attendeeCount,
            orderNumber: row.api_order_id || `ORD-${String(row.id).substring(0, 8)}`,
            is_split_parent: childOrders.length > 0,
            child_order_numbers: childOrders.map((co) => co.orderNumber).filter(Boolean),
            suborders: childOrders.map((co) => ({
              id: co.id,
              orderNumber: co.orderNumber,
              date: co.scheduledDate,
              restaurant: co.restaurant,
              title: co.title,
            })),
          };

          return {
            id: row.id,
            type: 'order',
            date: row.scheduled_date,
            time: fmtTime(row.scheduled_date),
            restaurant: row.restaurant?.name || 'Unknown Restaurant',
            mealType,
            attendees: attendeeCount,
            attendeeDescription,
            status: row.order_status,
            notes: row.description ?? '',
            splitCount: childOrders.length,
            originalOrderData: detailPayload,
          };
        });

        if (!cancelled) {
          setOrders(mapped);
        }
      } catch (e) {
        if (!cancelled) { setErr(e?.message || 'Failed to load calendar data'); setOrders([]); }
      } finally {
        if (!cancelled) setLoadingOrders(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId, unionStartISO, unionEndISO, futureDaysBuffer, pastDaysBuffer]);

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
    const nextISO  = new Date(bufferFutureMs).toISOString();
    return (orders || [])
      .filter(o => o.type === 'order' &&
        o.date >= todayISO && o.date <= nextISO &&
        String(o.status).toLowerCase() !== 'completed')
      .sort((a,b) => new Date(a.date) - new Date(b.date));
  }, [orders, bufferFutureMs]);

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
        id, team_id, parent_order_id, title, description, meal_type, scheduled_date, created_at,
        order_status, total_amount, api_order_id, fulfillment_method,
        delivery_instructions,
        delivery_address_line1, delivery_address_line2, delivery_city, delivery_state, delivery_zip,
        subtotal_cents, total_without_tips_cents, total_with_tip_cents, sales_tax_cents, service_fee_cents, delivery_fee_cents,
        restaurant:restaurants!meal_orders_restaurant_id_fkey ( id, name, address ),
        payment_method:payment_methods ( id, card_name, last_four, is_default ),
        items:meal_order_items (
          id, team_member_id, product_id, name, description, image_url, notes,
          quantity, product_marked_price_cents, created_at, is_extra,
          team_member:team_members ( id, full_name, role ),
          customizations:meal_order_item_customizations (
            id, name,
            options:meal_order_item_options ( option_id, name, price_cents, quantity, metadata )
          )
        ),
        child_splits:meal_order_splits!meal_order_splits_parent_order_id_fkey (
          child_order:child_order_id (
            id,
            api_order_id,
            title,
            scheduled_date,
            restaurant:restaurants ( id, name )
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

    const childOrdersRaw = Array.isArray(data?.child_splits) ? data.child_splits : [];
    const childOrders = childOrdersRaw
      .map((split) => {
        const child = split?.child_order;
        if (!child?.id) return null;
        const orderNumber = child.api_order_id || `ORD-${String(child.id).substring(0, 8)}`;
        const partMatch = child.title ? child.title.match(/Part\s+(\d+)/i) : null;
        const partIndex = partMatch ? Number(partMatch[1]) : null;
        return {
          id: child.id,
          orderNumber,
          title: child.title || '',
          scheduledDate: child.scheduled_date,
          restaurant: child.restaurant?.name || data?.restaurant?.name || 'Unknown Restaurant',
          partIndex,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ai = Number.isFinite(a.partIndex) ? a.partIndex : Number.MAX_SAFE_INTEGER;
        const bi = Number.isFinite(b.partIndex) ? b.partIndex : Number.MAX_SAFE_INTEGER;
        if (ai !== bi) return ai - bi;
        return String(a.orderNumber).localeCompare(String(b.orderNumber));
      });

    const isSplitParent = childOrders.length > 0;
    const parentOrderNumber = data?.api_order_id || `ORD-${String(data?.id || '').substring(0, 8)}`;

    const normalizeExtraFlag = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const val = value.trim().toLowerCase();
        return val === 'true' || val === 't' || val === '1' || val === 'yes';
      }
      return false;
    };

    const normalizedItems = (data?.items || []).map((it, idx) => {
      const quantity = Math.max(1, Number(it?.quantity ?? 1));
      const member = it?.team_member
        ? {
            id: it.team_member.id,
            name: it.team_member.full_name,
            role: it.team_member.role || '',
          }
        : null;

      return {
        ...it,
        quantity,
        is_extra: normalizeExtraFlag(it?.is_extra),
        member,
        display_index: idx,
      };
    });

    const shaped = {
      ...data,
      items: normalizedItems,
      restaurantName: data?.restaurant?.name ?? null,
      restaurantAddress: data?.restaurant?.address ?? null,
      fulfillment_method: data?.fulfillment_method ?? null,
      locationDisplay,
      orderNumber: parentOrderNumber,
      is_split_parent: isSplitParent,
      child_order_numbers: childOrders.map((co) => co.orderNumber).filter(Boolean),
      suborders: childOrders.map((co) => ({
        id: co.id,
        orderNumber: co.orderNumber,
        title: co.title,
        date: co.scheduledDate,
        restaurant: co.restaurant,
      })),
      orderItems: normalizedItems.map((it) => ({
        id: it.id,
        name: it.name,
        notes: it.notes || null,
        quantity: it.quantity,
        unitPriceCents: it.product_marked_price_cents ?? null,
        is_extra: normalizeExtraFlag(it?.is_extra),
        member: it.member,
        team_member: it.team_member ?? null,
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

  // ------- Cancel order (optimistic update + cache patch) -------
  const cancelOrder = useCallback(async (orderId) => {
    if (!orderId || !activeTeamId) return false;

    // Optimistic state update
    setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: 'cancelled' } : o)));

    try {
      const { error } = await supabase
        .from('meal_orders')
        .update({ order_status: 'cancelled' })
        .eq('team_id', activeTeamId)
        .eq('id', orderId);

      if (error) throw error;

      // Patch detail cache if present
      if (detailCache.current.has(orderId)) {
        const cached = detailCache.current.get(orderId);
        detailCache.current.set(orderId, { ...cached, order_status: 'cancelled', status: 'cancelled' });
      }
      return true;
    } catch (e) {
      // Revert optimistic update on failure
      setOrders(prev => prev.map(o => (o.id === orderId ? { ...o, status: o.status || 'scheduled' } : o)));
      console.error('cancelOrder failed:', e);
      return false;
    }
  }, [activeTeamId]);

  // ------- Birthday reminder (SMS + email fallback + notification) -------
  const remindCoaches = useCallback(async (bdayEvt) => {
    if (!activeTeamId || !bdayEvt) return { sentSms: 0, totalSms: 0, sentEmail: 0 };

    // coaches on team
    const { data: coaches, error: coachErr } = await supabase
      .from('team_members')
      .select('user_id, full_name, email, phone_number')
      .eq('team_id', activeTeamId)
      .eq('role', 'coach');

    if (coachErr) throw coachErr;

    // exclude current user
    const recipients = (coaches ?? []).filter((c) =>
      (currentUser?.id ? c.user_id !== currentUser.id : true) &&
      (currentUser?.email ? c.email !== currentUser.email : true)
    );

    const age = computeAge(bdayEvt.date, bdayEvt.dob);
    const smsText = `🎂 ${bdayEvt.memberName} turns ${age} today!`;

    // phone formatting + SMS
    const recWithPhones = recipients.map((r) => ({ ...r, phone_e164: toE164US(r.phone_number) }));
    const smsTargets = recWithPhones.filter((r) => !!r.phone_e164).map((r) => r.phone_e164);

    let failed = new Set();
    let invalid = new Set();

    if (smsTargets.length) {
      const { data: smsRes, error: smsErr } = await supabase.functions.invoke('send-sms', {
        body: { to: smsTargets, text: smsText },
      });
      if (smsErr) {
        console.error('send-sms error', smsErr);
        smsTargets.forEach((n) => failed.add(n));
      } else {
        const toValue = (x) => (typeof x === 'string' ? x : x?.to);
        (smsRes?.failed ?? []).map(toValue).filter(Boolean).forEach((n) => failed.add(n));
        (smsRes?.invalid ?? []).map(toValue).filter(Boolean).forEach((n) => invalid.add(n));
      }
    }

    const emailFallback = recWithPhones
      .filter((r) => !r.phone_e164 || failed.has(r.phone_e164) || invalid.has(r.phone_e164))
      .map((r) => r.email)
      .filter(Boolean);

    let sentEmail = 0;
    if (emailFallback.length) {
      const subject = `Birthday reminder: ${bdayEvt.memberName}`;
      const { error: emailErr } = await supabase.functions.invoke('send-email', {
        body: {
          to: emailFallback,
          subject,
          html: `<h2>${bdayEvt.memberName} turns ${age} today! 🎉</h2>`,
          text: `${bdayEvt.memberName} turns ${age} today! 🎉`,
        },
      });
      if (emailErr) console.error('send-email error', emailErr);
      else sentEmail = emailFallback.length;
    }

    // notification record
    const message = `${bdayEvt.memberName} has a birthday today!`;
    const payload = { memberId: bdayEvt.memberId, memberName: bdayEvt.memberName, dob: bdayEvt.dob, date: bdayEvt.date, type: 'birthday_reminder' };
    const { error: notifErr } = await supabase
      .from('notifications')
      .insert({ team_id: activeTeamId, type: 'birthday_reminder', message, payload });
    if (notifErr) console.warn('notifications insert failed:', notifErr.message);

    const deliveredSms = smsTargets.length - failed.size - invalid.size;
    return { sentSms: Math.max(deliveredSms, 0), totalSms: smsTargets.length, sentEmail };
  }, [activeTeamId, currentUser]);

  // ------- DRAFT CARTS: single query in union window -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeTeamId) { if (!cancelled) setCarts([]); return; }
      try {
        // NOTE: fulfillment_date is a DATE column, so compare with YYYY-MM-DD
        const dStart = unionStartISO;
        const dEnd   = unionEndISO;

        const { data: cartRows, error: cartErr } = await supabase
          .from('meal_carts')
          .select(`
            id, team_id, title, status, created_at,
            restaurant:restaurants ( id, name, address ),
            fulfillment_date, fulfillment_time
          `)
          .eq('team_id', activeTeamId)
          .in('status', ['draft', 'abandoned'])
          .not('fulfillment_date', 'is', null)
          .gte('fulfillment_date', dStart)
          .lte('fulfillment_date', dEnd)
          .order('fulfillment_date', { ascending: true })
          .order('fulfillment_time', { ascending: true });

        if (cartErr) throw cartErr;

        const mapped = (cartRows ?? [])
          .map((row) => {
            const iso = isoFromPgDateTime(row.fulfillment_date, row.fulfillment_time);
            if (!iso) return null; // guard
            const isPast = new Date(iso) < new Date();
            // Prefer DB status; fall back to deriving abandoned only for draft-in-past
            const normalizedStatus = (row.status === 'abandoned')
              ? 'abandoned'
              : (row.status === 'draft' && isPast ? 'abandoned' : 'draft');
            return {
              id: `cart-${row.id}`,
              type: 'cart',
              cartId: row.id,
              status: normalizedStatus,
              date: iso,
              time: iso ? fmtTime(iso) : 'TBD',
              restaurant: row.restaurant?.name || 'Draft Cart',
              label: row.title || 'Draft Cart',
              originalCartData: row,
            };
          })
          .filter(Boolean);

        if (!cancelled) setCarts(mapped);
      } catch (e) {
        if (!cancelled) {
          console.warn('load carts error:', e);
          setCarts([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTeamId, unionStartISO, unionEndISO]);

  const loading = loadingOrders || loadingMembers;
  return {
    loading,
    error,
    orders,
    teamMembers,
    birthdayEvents,
    upcomingNow,
    getOrderDetail,
    cancelOrder,
    remindCoaches,
    carts
  };
}
export default useCalendarData;
