// src/pages/calendar-order-scheduling/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { downloadReceiptPdf, downloadReceiptsZip } from '../../utils/receipts';
import { useCalendarData } from '@/hooks/calendar-order-scheduling';
import { computeAge, toE164US, fmtTime } from '../../utils/calendarUtils';
import CartDetailsModal from '../../components/ui/cart/CartDetailsModal';
import MobileSchedule from './components/MobileSchedule';
import { compareEvents } from './utils/events';

/* ----------------- component ----------------- */

const CalendarOrderScheduling = () => {
  const { activeTeam, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [mobileFutureDays, setMobileFutureDays] = useState(30);

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
  const { loading, error: loadErr, orders, teamMembers, birthdayEvents, upcomingNow, getOrderDetail, cancelOrder, remindCoaches, carts } = useCalendarData(
    activeTeam?.id,
    currentDate,
    viewMode,
    user,
    { futureDaysBuffer: isMobile ? mobileFutureDays : 7 }
  );

  // merge orders + birthdays
  const calendarEvents = useMemo(() => {
    const events = [...orders, ...birthdayEvents, ...(carts ?? [])];
    events.sort(compareEvents);
    return events;
  }, [orders, birthdayEvents, carts, activeTeam?.id]);

  // responsiveness
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setMobileFutureDays(30);
    }
  }, [isMobile]);

  // open schedule modal when navigated with state flag
  const shouldOpenScheduleModal = location.state?.openScheduleModal;
  const openOrderIdFromNav = location.state?.openOrderId;

  useEffect(() => {
    if (shouldOpenScheduleModal) {
      setIsScheduleModalOpen(true);
      navigate(location.pathname, { replace: true, state: undefined });
    }
  }, [shouldOpenScheduleModal, location.pathname, navigate]);

  // If navigated with an order id, open full details
  useEffect(() => {
    if (!openOrderIdFromNav) return;
    handleOpenDetail(openOrderIdFromNav);
    navigate(location.pathname, { replace: true, state: undefined });
  }, [openOrderIdFromNav, navigate, location.pathname]);

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
      case 'receipt': {
        if (!order) return;
        const subordersForDownload = Array.isArray(order?.suborders)
          ? order.suborders
          : Array.isArray(order?.originalOrderData?.suborders)
            ? order.originalOrderData.suborders
            : [];

        const childIds = subordersForDownload.map((so) => so?.id).filter(Boolean);

        if (childIds.length > 0) {
          await downloadReceiptsZip(childIds);
        } else if (order?.id) {
          await downloadReceiptPdf(order.id);
        }
        return;
      }
      default:
        return;
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

          {!isMobile && (
            <div className="mb-6">
              <TopPanel
                upcomingMeals={upcomingNow}
                onScheduleNew={handleScheduleNew}
                onOrderClick={handleOrderClick}
                loading={loading}
              />
              <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
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
            </div>
          )}

          {isMobile && (
            <MobileSchedule
              events={calendarEvents}
              loading={loading}
              onSelectEvent={handleEventClick}
              onSchedule={handleScheduleNew}
              futureDays={mobileFutureDays}
              onLoadMore={() => setMobileFutureDays((prev) => prev + 30)}
            />
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
