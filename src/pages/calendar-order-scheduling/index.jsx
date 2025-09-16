// src/pages/calendar-order-scheduling/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import TopPanel from './components/TopPanel';
import ScheduleMealModal from './components/ScheduleMealModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import OrderDetailModal from '../order-history-management/components/OrderDetailModal';
import Button from '../../components/ui/custom/Button';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts';
import BirthdayDetailsModal from './components/BirthdayDetailsModal';
import { getStatusBadge } from '../../utils/ordersUtils';
import { downloadReceiptPdf } from '../../utils/receipts';
import { useCalendarData } from '@/hooks/calendar-order-scheduling';
import { computeAge, toE164US, fmtTime } from '../../utils/calendarUtils';

/* ----------------- component ----------------- */

const CalendarOrderScheduling = () => {
  const { activeTeam, user } = useAuth();
  const navigate = useNavigate();

  // calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('twoWeeks');
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // UI state
  const [filters, setFilters] = useState({ mealType: 'all', restaurant: 'all' });
  const [isMobile, setIsMobile] = useState(false);

  // modals
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [isHistoryDetailOpen, setIsHistoryDetailOpen] = useState(false);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);

  // selections
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBirthday, setSelectedBirthday] = useState(null);

  // full-detail data
  const [historyDetailOrder, setHistoryDetailOrder] = useState(null);
  const [fullDetailLoading, setFullDetailLoading] = useState(false);

  // data from hook
  const {
    loading,
    error: loadErr,
    orders,
    teamMembers,
    birthdayEvents,
    upcomingNow,
  } = useCalendarData(activeTeam?.id, currentDate, viewMode);

  // merge orders + birthdays
  const calendarEvents = useMemo(() => {
    const events = [...orders, ...birthdayEvents];
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
  }, [orders, birthdayEvents]);

  // responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // handlers
  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleScheduleNew = () => setIsScheduleModalOpen(true);

  // open light details from calendar/upcoming lists
  const handleOrderClick = (orderEvent) => {
    setSelectedOrder(orderEvent?.originalOrderData || null);
    setIsOrderDetailsModalOpen(true);
  };

  const handleEventClick = (evt) => {
    if (evt?.type === 'birthday') {
      setSelectedBirthday(evt);
      setIsBirthdayModalOpen(true);
    } else {
      setSelectedOrder(evt?.originalOrderData || null);
      setIsOrderDetailsModalOpen(true);
    }
  };

  const handleEditOrder = (order) => console.log('Edit order:', order);

  const handleCancelOrder = (orderId) =>
    // TODO below does not work
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'cancelled' } : o)));

  const handleScheduleRedirect = (payload) => {
    const params = new URLSearchParams({
      mealType: payload.mealType,
      date: payload.date,
      time: payload.time,
      service: payload.serviceType,
      address: payload.address || '',
      delivery_address: payload.delivery_address || '',
      ...(payload.coords ? { lat: String(payload.coords.lat), lng: String(payload.coords.lng) } : {}),
      whenISO: payload.whenISO,
    });

    navigate(`/home-restaurant-discovery?${params.toString()}`);
    setIsScheduleModalOpen(false);
  };

  // remove is_active from this query per your decision to drop that flag
  async function handleRemindCoaches(bdayEvt) {
    if (!activeTeam?.id) return;
    const { data: coaches, error: coachErr } = await supabase
      .from('team_members')
      .select('user_id, full_name, email, phone_number')
      .eq('team_id', activeTeam.id)
      .eq('role', 'coach');

    if (coachErr) {
      alert('Could not load coaches: ' + coachErr.message);
      return;
    }

    const recipients = (coaches ?? []).filter(
      (c) => (user?.id ? c.user_id !== user.id : true) && (user?.email ? c.email !== user.email : true)
    );

    if (recipients.length === 0) {
      alert('No other coaches to notify.');
      return;
    }

    const age = computeAge(bdayEvt.date, bdayEvt.dob);
    const smsText = `🎂 ${bdayEvt.memberName} turns ${age} today!`;

    const recWithPhones = recipients.map((r) => ({ ...r, phone_e164: toE164US(r.phone_number) }));
    const smsTargets = recWithPhones.filter((r) => !!r.phone_e164).map((r) => r.phone_e164);

    let failedE164 = new Set();
    let invalidE164 = new Set();

    if (smsTargets.length) {
      const { data: smsRes, error: smsErr } = await supabase.functions.invoke('send-sms', {
        body: { to: smsTargets, text: smsText },
      });
      if (smsErr) {
        console.error('send-sms error', smsErr);
        smsTargets.forEach((n) => failedE164.add(n));
      } else {
        const toValue = (x) => (typeof x === 'string' ? x : x?.to);
        (smsRes?.failed ?? []).map(toValue).filter(Boolean).forEach((n) => failedE164.add(n));
        (smsRes?.invalid ?? []).map(toValue).filter(Boolean).forEach((n) => invalidE164.add(n));
      }
    }

    const emailFallback = recWithPhones
      .filter((r) => !r.phone_e164 || failedE164.has(r.phone_e164) || invalidE164.has(r.phone_e164))
      .map((r) => r.email)
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
    const payload = { memberId: bdayEvt.memberId, memberName: bdayEvt.memberName, dob: bdayEvt.dob, date: bdayEvt.date, type: 'birthday_reminder' };
    const { error: notifErr } = await supabase
      .from('notifications')
      .insert({ team_id: activeTeam.id, type: 'birthday_reminder', message, payload });
    if (notifErr) console.warn('notifications insert failed:', notifErr.message);

    const deliveredSms = smsTargets.length - failedE164.size - invalidE164.size;
    const deliveredEmail = emailFallback.length;
    alert(`Reminder sent.\nSMS: ${Math.max(deliveredSms, 0)}/${smsTargets.length}\nEmail fallback: ${deliveredEmail}`);
  }

  // open full detail modal (fetch full record)
  const handleOpenDetail = async (orderId) => {
    if (!orderId || !activeTeam?.id) return;
    setFullDetailLoading(true);
    setIsOrderDetailsModalOpen(false);

    try {
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
             options:meal_order_item_options (
               option_id, name, price_cents, quantity, metadata
             )
           )
         )
       `)
       .eq('team_id', activeTeam.id)
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

      setHistoryDetailOrder(shaped);
      setIsHistoryDetailOpen(true);
    } catch (e) {
      console.error('Failed to load full order:', e);
      alert('Sorry—could not load the full order details.');
    } finally {
      setFullDetailLoading(false);
    }
  };

  const handleAction = async (type, order) => {
    switch (type) {
      case 'receipt':
        return downloadReceiptPdf(order?.id);
      // other cases…
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
                <p className="text-muted-foreground mt-2">
                  Schedule and manage team meal orders with interactive calendar
                </p>
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
              upcomingMeals={upcomingNow}
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
                    ) : upcomingNow.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingNow.map((meal) => (
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
                                  <span>
                                    {new Date(meal.date).toLocaleDateString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                    })}
                                  </span>
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
                    onNewOrder={(d) => {
                      const dd = new Date(d);
                      dd.setHours(0, 0, 0, 0);
                      setSelectedDate(dd);
                      setIsScheduleModalOpen(true);
                    }}
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

      {/* small loading chip while fetching full details */}
      {fullDetailLoading && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none">
          <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground shadow">Loading…</div>
        </div>
      )}

      {/* Modals */}
      <ScheduleMealModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        selectedDate={selectedDate}
        onSchedule={handleScheduleRedirect}
        teamMembers={teamMembers}
      />

      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrder}
        onEdit={handleEditOrder}
        onCancel={handleCancelOrder}
        onOpenDetail={(id) => handleOpenDetail(id ?? selectedOrder?.id)}
      />

      <OrderDetailModal
        order={historyDetailOrder}
        isOpen={isHistoryDetailOpen}
        onClose={() => setIsHistoryDetailOpen(false)}
        onAction={handleAction}
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