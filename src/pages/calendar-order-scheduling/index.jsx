// src/pages/calendar-order-scheduling/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import TopPanel from './components/TopPanel';
import ScheduleMealModal from '../../components/ui/schedule-meals/ScheduleMealModal';
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
import CartDetailsModal from '../../components/ui/cart/CartDetailsModal';

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
  const [selectedCartId, setSelectedCartId] = useState(null);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);

  // selections
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedBirthday, setSelectedBirthday] = useState(null);

  // full-detail data
  const [historyDetailOrder, setHistoryDetailOrder] = useState(null);
  const [fullDetailLoading, setFullDetailLoading] = useState(false);

  // data from hook
  const { loading, error: loadErr, orders, teamMembers, birthdayEvents, upcomingNow, getOrderDetail, cancelOrder, remindCoaches, carts } = useCalendarData(activeTeam?.id, currentDate, viewMode);

  // merge orders + birthdays
  const calendarEvents = useMemo(() => {
    const events = [...orders, ...birthdayEvents, ...(carts ?? [])];
    const typePriority = (t) => (t === 'birthday' ? 0 : t === 'cart' ? 1 : 2);
    events.sort((a, b) => {
      const da = new Date(a.date); const db = new Date(b.date);
      const dayA = new Date(da.getFullYear(), da.getMonth(), da.getDate()).getTime();
      const dayB = new Date(db.getFullYear(), db.getMonth(), db.getDate()).getTime();
      if (dayA !== dayB) return dayA - dayB;

      const pa = typePriority(a.type); const pb = typePriority(b.type);
      if (pa !== pb) return pa - pb;

      const ta = da.getHours() * 60 + da.getMinutes();
      const tb = db.getHours() * 60 + db.getMinutes();
      if (ta !== tb) return ta - tb;

      const la = (a.restaurant ?? a.label ?? '').toString();
      const lb = (b.restaurant ?? b.label ?? '').toString();
      return la.localeCompare(lb);
    });
    return events;
  }, [orders, birthdayEvents, carts]);

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
    } else if (evt?.type === 'cart') {
      setSelectedCartId(evt.cartId);
      setIsCartModalOpen(true);
   } else {
      setSelectedOrder(evt?.originalOrderData || null);
      setIsOrderDetailsModalOpen(true);
    }
  };

  const handleEditOrder = (order) => console.log('Edit order:', order);

  const handleCancelOrder = async (orderId) => {
    const ok = await cancelOrder(orderId);
    if (!ok) alert('Could not cancel order. Please try again.');
  };

  const handleScheduleRedirect = (payload) => {
    const params = new URLSearchParams({
      title: payload.title,
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

  const handleRemindCoaches = async (bdayEvt) => {
    try {
      const res = await remindCoaches(bdayEvt);
      alert(`Reminder sent.\nSMS: ${res.sentSms}/${res.totalSms}\nEmail fallback: ${res.sentEmail}`);
    } catch (e) {
      console.error(e);
      alert('Failed to send birthday reminders.');
    }
  };

  // open full detail modal (fetch full record)
  const handleOpenDetail = async (orderId) => {
    if (!orderId || !activeTeam?.id) return;
    setFullDetailLoading(true);
    setIsOrderDetailsModalOpen(false);
    try {
      const detail = await getOrderDetail(orderId);
      setHistoryDetailOrder(detail);
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

      <CartDetailsModal
        isOpen={isCartModalOpen}
        onClose={() => setIsCartModalOpen(false)}
        cartId={selectedCartId}
      />
    </div>
  );
};

export default CalendarOrderScheduling;