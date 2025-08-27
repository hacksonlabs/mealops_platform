import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import TopPanel from './components/TopPanel';
import ScheduleMealModal from './components/ScheduleMealModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts';
import BirthdayDetailsModal from './components/BirthdayDetailsModal';


function getRangeForView(currentDate, viewMode) {
  const start = new Date(currentDate);
  start.setHours(0, 0, 0, 0);

  if (viewMode === 'twoWeeks') {
    // start on Sunday of this week, show 14 days
    const dow = start.getDay();
    start.setDate(start.getDate() - dow);
    const end = new Date(start);
    end.setDate(start.getDate() + 13);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // default to full month
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
  // If JS rolls the date to next month (e.g., Feb 29 -> Mar 1), fallback to previous day
  if (candidate.getMonth() !== m) {
    return new Date(year, m, d - 1);
  }
  return candidate;
}

const CalendarOrderScheduling = () => {
  const { activeTeam } = useAuth();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('twoWeeks');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [selectedBirthday, setSelectedBirthday] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({ mealType: 'all', restaurant: 'all' });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Loaded from DB
  const [orders, setOrders] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [birthdayEvents, setBirthdayEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  // Saved templates (still local for now)
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
        setOrders([]);
        setTeamMembers([]);
        setBirthdayEvents([]);
        return;
      }

      setLoading(true);
      try {
        const { start, end } = getRangeForView(currentDate, viewMode);

        // orders with restaurant name
        // NOTE: the implicit relation should be available via FK restaurant_id -> restaurants.id
        const { data: orderRows, error: orderErr } = await supabase
          .from('meal_orders')
          .select(`
            id,
            team_id,
            restaurant_id,
            scheduled_date,
            order_status,
            description,
            created_at,
            restaurants ( name )
          `)
          .eq('team_id', activeTeam.id)
          .gte('scheduled_date', start.toISOString())
          .lte('scheduled_date', end.toISOString())
          .order('scheduled_date', { ascending: true });

        if (orderErr) throw orderErr;

        const orderIds = orderRows?.map(o => o.id) ?? [];

        // attendees = distinct user_ids per order from order_items
        let attendeesByOrder = {};
        if (orderIds.length > 0) {
          const { data: itemRows, error: itemsErr } = await supabase
            .from('order_items')
            .select('order_id, user_id')
            .in('order_id', orderIds);

          if (itemsErr) throw itemsErr;

          const map = new Map(); // order_id -> Set(user_id)
          itemRows?.forEach(({ order_id, user_id }) => {
            if (!map.has(order_id)) map.set(order_id, new Set());
            if (user_id) map.get(order_id).add(user_id);
          });
          attendeesByOrder = Object.fromEntries(
            [...map.entries()].map(([k, v]) => [k, v.size])
          );
        }

        // team members for the modal
        const { data: memberRows, error: membersErr } = await supabase
          .from('team_members')
          .select('id, user_id, full_name, role, email, allergies, birthday')
          .eq('team_id', activeTeam.id)
          .eq('is_active', true);

        if (membersErr) throw membersErr;

        // map DB rows -> UI shape your grid/cards expect
        const mapped = orderRows.map(row => ({
          id: row.id,
          type: 'order',
          date: row.scheduled_date,                                   
          restaurant: row.restaurants?.name || 'Unknown Restaurant',
          mealType: 'lunch',                                           // not in schema; set a default or add a column later
          time: fmtTime(row.scheduled_date),
          attendees: attendeesByOrder[row.id] ?? 0,
          status: row.order_status,
          notes: row.description ?? '',
          createdAt: row.created_at,
          members: []                                                 
        }));

        setOrders(mapped);
        const simplifiedMembers = (memberRows ?? []).map(m => ({
          id: m.id,
          name: m.full_name,
          role: m.role,
          email: m.email,
          allergies: m.allergies || null,
          birthday: m.birthday || null
        }));
        setTeamMembers(simplifiedMembers);

        // Build birthday events inside current range
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
                dob: m.birthday,  // original DOB to compute age
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

  // ===== This Month (derived from currentDate + orders) ===== orders only (not birthdays)
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

  // Filters (still client-side)
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

  // FINAL event list rendered on the grid (orders + birthdays)
  const calendarEvents = useMemo(
    () => [...filteredOrders, ...birthdayEvents],
    [filteredOrders, birthdayEvents]
  );

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

  const handleDateSelect = (date) => setSelectedDate(date);
  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleScheduleNew = () => setIsScheduleModalOpen(true);

  // client-side updates for now
  const handleScheduleMeal = (orderData) => setOrders(prev => [...prev, orderData]);
  const handleOrderClick = (order) => { setSelectedOrder(order); setIsOrderDetailsModalOpen(true); };
  const handleQuickNewOrder = (date) => { const d = new Date(date); d.setHours(0,0,0,0); setSelectedDate(d); setIsScheduleModalOpen(true); };
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
      setSelectedOrder(evt);
      setIsOrderDetailsModalOpen(true);
    }
  };

  async function handleRemindCoaches(bdayEvt) {
    if (!activeTeam?.id) return;

    // pull coaches
    const { data: coaches, error: coachErr } = await supabase
      .from('team_members')
      .select('email, full_name')
      .eq('team_id', activeTeam.id)
      .eq('is_active', true)
      .in('role', ['coach', 'assistant_coach', 'head_coach']);

    if (coachErr) {
      alert('Could not load coaches: ' + coachErr.message);
      return;
    }

    const emails = (coaches ?? []).map(c => c.email).filter(Boolean);

    // try to insert an app notification
    const message = `${bdayEvt.memberName} has a birthday today!`;
    const payload = {
      memberId: bdayEvt.memberId,
      memberName: bdayEvt.memberName,
      dob: bdayEvt.dob,
      date: bdayEvt.date,
      type: 'birthday_reminder'
    };

    let inserted = false;
    try {
      const { error: notifErr } = await supabase.from('notifications').insert({
        team_id: activeTeam.id,
        type: 'birthday_reminder',
        message,
        payload
      });
      if (!notifErr) inserted = true;
    } catch (_) {}

    if (inserted) {
      alert('Reminder created for all coaches.');
      return;
    }

    // fallback: open an email draft to all coaches
    if (emails.length) {
      const subject = encodeURIComponent(`Birthday reminder: ${bdayEvt.memberName}`);
      const body = encodeURIComponent(
        `${bdayEvt.memberName} turns ${(() => {
          const d = new Date(bdayEvt.date);
          const dob = new Date(bdayEvt.dob);
          let age = d.getFullYear() - dob.getFullYear();
          const m = d.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && d.getDate() < dob.getDate())) age--;
          return age;
        })()} today! 🎉`
      );
      window.location.href = `mailto:${emails.join(',')}?subject=${subject}&body=${body}`;
    } else {
      alert('No coach emails found to remind.');
    }
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

          {loadErr && (
            <div className="mb-4 text-sm text-red-600">{loadErr}</div>
          )}

          <div className="mb-6">
            <TopPanel
              upcomingMeals={upcomingMeals}
              monthStats={monthStats}
              onScheduleNew={handleScheduleNew}
              onOrderClick={handleOrderClick}
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
            <div className={isMobile ? 'order-1' : 'lg:col-span-3'}>
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
                              <span className={`
                                text-xs px-2 py-1 rounded-full border font-medium
                                ${meal.status === 'scheduled' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-green-600 bg-green-50 border-green-200'}
                              `}>
                                {meal.status}
                              </span>
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
                    onOrderClick={handleEventClick}
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
        onSchedule={handleScheduleMeal}
        teamMembers={teamMembers}
        savedTemplates={savedTemplates}
      />
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrder}
        onEdit={handleEditOrder}
        onCancel={handleCancelOrder}
        onRepeat={handleRepeatOrder}
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