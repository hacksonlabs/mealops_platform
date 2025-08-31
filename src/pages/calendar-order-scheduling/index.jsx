import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import TopPanel from './components/TopPanel';
import ScheduleMealModal from './components/ScheduleMealModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import OrderDetailModal from '../order-history-management/components/OrderDetailModal';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts';
import BirthdayDetailsModal from './components/BirthdayDetailsModal';
import { getStatusBadge } from '../../utils/ordersUtils';

/* ----------------- helpers ----------------- */

function getRangeForView(currentDate, viewMode) {
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);

  if (viewMode === 'twoWeeks') {
    const dow = start.getDay();
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const mStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const mEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: mStart, end: mEnd };
}

function fmtTime(iso) {
  const d = new Date(iso);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function mkBirthdayDateForYear(birthdayISO, year) {
  const b = new Date(birthdayISO);
  const m = b.getMonth();
  const d = b.getDate();
  const candidate = new Date(year, m, d);
  if (candidate.getMonth() !== m) return new Date(year, m, d - 1);
  return candidate;
}

function computeAge(onDateISO, dobISO) {
  const d = new Date(onDateISO);
  const dob = new Date(dobISO);
  let age = d.getFullYear() - dob.getFullYear();
  const m = d.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && d.getDate() < dob.getDate())) age--;
  return age;
}

function toE164US(raw) {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('+')) return trimmed;
  const d = trimmed.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  if (d.length === 10) return `+1${d}`;
  return null;
}

/* --------------- component ---------------- */

const CalendarOrderScheduling = () => {
  const { activeTeam, user } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('twoWeeks');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [selectedBirthday, setSelectedBirthday] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({ mealType: 'all', restaurant: 'all' });
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);
  const [historyDetailOrder, setHistoryDetailOrder] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });

  // Loaded from DB
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdayEvents, setBirthdayEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  // Saved templates (local)
  const savedTemplates = [
    { id: 'template-1', name: 'Pre-Game Breakfast', restaurant: 'panera', mealType: 'breakfast', time: '08:00', members: [], notes: '' },
    { id: 'template-2', name: 'Team Lunch Meeting',  restaurant: 'chipotle', mealType: 'lunch',    time: '12:30', members: [], notes: '' },
    { id: 'template-3', name: 'Post-Practice Dinner', restaurant: 'olive-garden', mealType: 'dinner', time: '18:00', members: [], notes: '' },
  ];

  // Fetch orders + attendees + team members
  useEffect(() => {
    const run = async () => {
      setLoadErr('');
      if (!activeTeam?.id) {
        setOrders([]); setTeamMembers([]); setBirthdayEvents([]); return;
      }

      setLoading(true);
      try {
        const { start, end } = getRangeForView(currentDate, viewMode);

        const { data: orderRows, error: orderErr } = await supabase
          .from('meal_orders')
          .select(`
            id,
            team_id,
            title,
            description,
            meal_type,
            scheduled_date,
            order_status,
            fulfillment_method,
            delivery_instructions,
            created_at,
            restaurants:restaurants ( id, name ),
            order_items:order_items (
              id, user_id, team_member_id,
              user_profiles:user_profiles ( first_name, last_name ),
              team_members:team_members ( full_name, role )
            )
          `)
          .eq('team_id', activeTeam.id)
          .gte('scheduled_date', start.toISOString())
          .lte('scheduled_date', end.toISOString())
          .order('scheduled_date', { ascending: true });

        if (orderErr) throw orderErr;

        // Build event + originalOrderData
        const mapped = (orderRows || []).map((row) => {
          // dedupe attendees
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

          // normalize meal type (fallbacks)
          const mealType = (() => {
            if (row.meal_type) return row.meal_type;
            const haystack = `${row.title ?? ''} ${row.description ?? ''}`.toLowerCase();
            if (/\bbreakfast\b/.test(haystack)) return 'breakfast';
            if (/\blunch\b/.test(haystack))     return 'lunch';
            if (/\bdinner\b/.test(haystack))    return 'dinner';
            if (/\bsnacks?\b/.test(haystack))   return 'snack';
            return 'other';
          })();

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
            team_members, // [{ name, role }]
          };

          // event used by calendar & upcoming list
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

        setOrders(mapped);

        // Separate team member list (if other UIs need it)
        const { data: memberRows, error: membersErr } = await supabase
          .from('team_members')
          .select('id, user_id, full_name, role, email, allergies, birthday')
          .eq('team_id', activeTeam.id)
          .eq('is_active', true);

        if (membersErr) throw membersErr;

        const simplifiedMembers = (memberRows ?? []).map(m => ({
          id: m.id,
          name: m.full_name,
          role: m.role,
          email: m.email,
          allergies: m.allergies || null,
          birthday: m.birthday || null
        }));
        setTeamMembers(simplifiedMembers);

        // Birthdays inside current range
        const years = new Set([start.getFullYear(), end.getFullYear()]);
        const bdayEvents = [];
        simplifiedMembers.forEach((m) => {
          if (!m.birthday) return;
          years.forEach((yr) => {
            const d = mkBirthdayDateForYear(m.birthday, yr);
            if (d >= start && d <= end) {
              bdayEvents.push({
                id: `bday-${m.id}-${yr}`,
                type: 'birthday',
                date: d.toISOString(),
                label: `${m.name}'s Bday!`,
                memberId: m.id,
                memberName: m.name,
                dob: m.birthday,
                status: 'birthday'
              });
            }
          });
        });
        setBirthdayEvents(bdayEvents);
      } catch (e) {
        console.error('Load calendar orders failed:', e);
        setLoadErr(e?.message || 'Failed to load orders');
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [activeTeam?.id, currentDate, viewMode]);

  // ===== This Month (orders only) =====
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.date);
    return d >= monthStart && d <= monthEnd;
  });

  const getOrderCost = (o) =>
    Number(o.totalCost ?? ((o.attendees || 0) * (o.costPerAttendee ?? 12)));

  const monthStats = useMemo(() => {
    const totalMeals = thisMonthOrders.length;
    const totalSpent = thisMonthOrders.reduce((sum, o) => sum + getOrderCost(o), 0);
    const avgPerMeal = totalMeals ? totalSpent / totalMeals : 0;
    return { totalMeals, totalSpent, avgPerMeal };
  }, [thisMonthOrders]);

  // Client-side filters for calendar
  const filteredOrders = orders.filter(order => {
    if (filters.mealType !== 'all' && order.mealType !== filters.mealType) return false;
    if (filters.restaurant !== 'all') {
      const map = {
        'chipotle': 'Chipotle Mexican Grill',
        'subway': 'Subway',
        'panera': 'Panera Bread',
        'olive-garden': 'Olive Garden',
        'local-deli': 'Local Deli & Catering'
      };
      if (order.restaurant !== map[filters.restaurant]) return false;
    }
    return true;
  });

  // FINAL events on the grid (orders + birthdays)
  const calendarEvents = useMemo(() => {
    const events = [...filteredOrders, ...birthdayEvents];
    events.sort((a, b) => {
      const da = new Date(a.date);
      const db = new Date(b.date);
      const dayA = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
      const dayB = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
      if (dayA !== dayB) return dayA - dayB;
      const pa = a.type === 'birthday' ? 0 : 1;
      const pb = b.type === 'birthday' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      if (a.type === 'birthday' && b.type === 'birthday') return 0;
      const ta = da.getHours() * 60 + da.getMinutes();
      const tb = db.getHours() * 60 + db.getMinutes();
      return ta - tb;
    });
    return events;
  }, [filteredOrders, birthdayEvents]);

  // Next 7 days
  const upcomingMeals = orders
    .filter(order => {
      const orderDate = new Date(order.date);
      const today = new Date();
      today.setHours(0,0,0,0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      return orderDate >= today && orderDate <= nextWeek && order.status !== 'completed';
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleScheduleNew = () => setIsScheduleModalOpen(true);

  // Click handlers — always pass the *detail* payload to the modal
  const handleOrderClick = (orderEvent) => {
    setSelectedOrder(orderEvent?.originalOrderData || null);
    setIsOrderDetailsModalOpen(true);
  };

  const handleEditOrder = (order) => console.log('Edit order:', order);
  const handleCancelOrder = (orderId) => setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
  const handleRepeatOrder = () => { setSelectedDate(new Date()); setIsScheduleModalOpen(true); };
  const handleTemplateUse = () => { setSelectedDate(new Date()); setIsScheduleModalOpen(true); };

  const [isMobile, setIsMobile] = useState(false);
  const handleEventClick = (evt) => {
    if (evt?.type === 'birthday') {
      setSelectedBirthday(evt);
      setIsBirthdayModalOpen(true);
    } else {
      setSelectedOrder(evt?.originalOrderData || null);
      setIsOrderDetailsModalOpen(true);
    }
  };

  // Birthday reminder flow (unchanged)
  async function handleRemindCoaches(bdayEvt) {
    if (!activeTeam?.id) return;
    const { data: coaches, error: coachErr } = await supabase
      .from('team_members')
      .select('user_id, full_name, email, phone_number')
      .eq('team_id', activeTeam.id)
      .eq('is_active', true)
      .eq('role', 'coach');

    if (coachErr) {
      alert('Could not load coaches: ' + coachErr.message);
      return;
    }

    const recipients = (coaches ?? []).filter(c =>
      (user?.id ? c.user_id !== user.id : true) &&
      (user?.email ? c.email !== user.email : true)
    );

    if (recipients.length === 0) {
      alert('No other coaches to notify.');
      return;
    }

    const age = computeAge(bdayEvt.date, bdayEvt.dob);
    const smsText = `🎂 ${bdayEvt.memberName} turns ${age} today!`;

    const recWithPhones = recipients.map(r => ({ ...r, phone_e164: toE164US(r.phone_number) }));
    const smsTargets = recWithPhones.filter(r => !!r.phone_e164).map(r => r.phone_e164);

    let failedE164 = new Set();
    let invalidE164 = new Set();

    if (smsTargets.length) {
      const { data: smsRes, error: smsErr } = await supabase.functions.invoke('send-sms', {
        body: { to: smsTargets, text: smsText },
      });
      if (smsErr) {
        console.error('send-sms error', smsErr);
        smsTargets.forEach(n => failedE164.add(n));
      } else {
        const toValue = (x) => (typeof x === 'string' ? x : x?.to);
        (smsRes?.failed  ?? []).map(toValue).filter(Boolean).forEach(n => failedE164.add(n));
        (smsRes?.invalid ?? []).map(toValue).filter(Boolean).forEach(n => invalidE164.add(n));
      }
    }

    const emailFallback = recWithPhones
      .filter(r => !r.phone_e164 || failedE164.has(r.phone_e164) || invalidE164.has(r.phone_e164))
      .map(r => r.email)
      .filter(Boolean);

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
    }

    const message = `${bdayEvt.memberName} has a birthday today!`;
    const payload = {
      memberId: bdayEvt.memberId, memberName: bdayEvt.memberName,
      dob: bdayEvt.dob, date: bdayEvt.date, type: 'birthday_reminder',
    };

    const { error: notifErr } = await supabase.from('notifications').insert({
      team_id: activeTeam.id, type: 'birthday_reminder', message, payload,
    });
    if (notifErr) console.warn('notifications insert failed:', notifErr.message);

    const deliveredSms = smsTargets.length - failedE164.size - invalidE164.size;
    const deliveredEmail = emailFallback.length;
    alert(`Reminder sent.\nSMS: ${Math.max(deliveredSms, 0)}/${smsTargets.length}\nEmail fallback: ${deliveredEmail}`);
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleOpenDetail = async (orderId) => {
    if (!orderId) return;
    setIsOrderDetailsModalOpen(false);

    try {
      const { data, error } = await supabase
        .from('meal_orders')
        .select(`
          id, team_id, title, description, meal_type, scheduled_date, created_at,
          order_status, total_amount, api_order_id,
          restaurants:restaurants (id, name, address),
          saved_locations:saved_locations (id, name, address),
          payment_methods:payment_methods (id, card_name, last_four, is_default),
          order_items:order_items (
            id, user_id, team_member_id, item_name, quantity, price, special_instructions,
            user_profiles:user_profiles (first_name, last_name),
            team_members:team_members (full_name)
          )
        `)
        .eq('team_id', activeTeam.id)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setHistoryDetailOrder(data);
      setIsHistoryDetailOpen(true);
    } catch (e) {
      console.error('Failed to load full order:', e);
      alert('Sorry—could not load the full order details.');
    }
  };


  return (
    <div className="min-h-screen bg-background">
      <Header notifications={3} />
      <main className="pt-16 pb-20 lg:pb-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">Calendar & Order Scheduling</h1>
                <p className="text-muted-foreground mt-2">Schedule and manage team meal orders with interactive calendar</p>
              </div>
              {!isMobile && (
                <Button onClick={handleScheduleNew} iconName="Plus" iconSize={16} size="lg">
                  Schedule New Meal
                </Button>
              )}
            </div>
          </div>

          {loadErr && <div className="mb-4 text-sm text-red-600">{loadErr}</div>}

          <div className="mb-6">
            <TopPanel
              upcomingMeals={upcomingMeals}
              monthStats={monthStats}
              onScheduleNew={handleScheduleNew}
              onOrderClick={handleOrderClick} // passes event (with originalOrderData) to modal
              loading={loading}
            />
          </div>

          {isMobile && (
            <div className="mb-6">
              <CalendarHeader
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onTodayClick={handleTodayClick}
                filters={filters}
                onFiltersChange={setFilters}
              />
            </div>
          )}

          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-1'}`}>
            <div className={isMobile ? 'order-1' : 'lg:col-span-1'}>
              {isMobile ? (
                <div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">Upcoming Meals</h3>
                      <Button variant="outline" size="sm" onClick={handleScheduleNew} iconName="Plus" iconSize={16}>
                        Schedule
                      </Button>
                    </div>

                    {loading ? (
                      <div className="text-sm text-muted-foreground py-6">Loading…</div>
                    ) : upcomingMeals.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingMeals.map(meal => (
                          <div
                            key={meal.id}
                            className="p-4 border border-border rounded-md hover:bg-muted/50 transition-athletic cursor-pointer"
                            onClick={() => handleOrderClick(meal)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-foreground">{meal.restaurant}</h4>
                                <p className="text-sm text-muted-foreground capitalize">{meal.mealType}</p>
                              </div>
                              {getStatusBadge(meal.status)}
                            </div>

                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1">
                                  <Icon name="Calendar" size={14} />
                                  <span>{new Date(meal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Icon name="Clock" size={14} />
                                  <span>{meal.time}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Icon name="Users" size={14} />
                                <span>{meal.attendees}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Icon name="Calendar" size={48} className="text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">No upcoming meals scheduled</p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-lg overflow-hidden">
                  <CalendarHeader
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onTodayClick={handleTodayClick}
                    filters={filters}
                    onFiltersChange={setFilters}
                    attached
                  />
                  <CalendarGrid
                    currentDate={currentDate}
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    orders={calendarEvents}
                    viewMode={viewMode}
                    onOrderClick={handleEventClick} // uses originalOrderData for the modal
                    onNewOrder={(d) => { const dd = new Date(d); dd.setHours(0,0,0,0); setSelectedDate(dd); setIsScheduleModalOpen(true); }}
                    attached
                    loading={loading}
                  />
                </div>
              )}
            </div>
          </div>

          {isMobile && (
            <div className="fixed bottom-6 right-6 z-40">
              <Button
                onClick={handleScheduleNew}
                size="lg"
                iconName="Plus"
                iconSize={20}
                className="rounded-full w-14 h-14 shadow-athletic-lg"
              />
            </div>
          )}
        </div>
      </main>

      <ScheduleMealModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        selectedDate={selectedDate}
        onSchedule={orderData => setOrders(prev => [...prev, orderData])}
        teamMembers={teamMembers}
        savedTemplates={savedTemplates}
      />
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrder}        
        onEdit={handleEditOrder}
        onCancel={handleCancelOrder}
        onOpenDetail={handleOpenDetail}
      />
      <OrderDetailModal
        order={historyDetailOrder}
        isOpen={isHistoryDetailOpen}
        onClose={() => setIsHistoryDetailOpen(false)}
      />
      <BirthdayDetailsModal
        isOpen={isBirthdayModalOpen}
        onClose={() => setIsBirthdayModalOpen(false)}
        event={selectedBirthday}
        onRemindCoaches={handleRemindCoaches}
      />
    </div>
  );
};

export default CalendarOrderScheduling;
