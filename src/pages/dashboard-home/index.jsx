import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { supabase } from '../../lib/supabase';
import cartDbService from '../../services/cartDBService';
import Header from '../../components/ui/Header';
import MetricsCard from './components/MetricsCard';
import { NextMealWidget } from './components/NextMealWidget';
import QuickActions from './components/QuickActions';
import UpcomingMealsCalendar from './components/UpcomingMealsCalendar';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { userProfile, activeTeam, loading: authLoading } = useAuth();

  // Dashboard state (live)
  const [teamSize, setTeamSize] = useState(0);
  const [upcomingOrders, setUpcomingOrders] = useState([]); // next 7 days
  const [openCartsCount, setOpenCartsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Derivations
  const nextMeal = useMemo(() => {
    if (!upcomingOrders?.length) return null;
    const first = upcomingOrders[0];
    const dt = new Date(first.scheduled_date);
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return {
      id: first.id,
      date: dt.toISOString().slice(0, 10),
      time: `${hh}:${mm}`,
      restaurant: first.restaurant_name || 'Restaurant',
      location: first.fulfillment_method === 'delivery'
        ? [first.delivery_address_line1, first.delivery_city, first.delivery_state, first.delivery_zip].filter(Boolean).join(', ')
        : (first.restaurant_address || ''),
      status: first.order_status || 'scheduled',
      fulfillment: first.fulfillment_method || null,
      mealType: first.meal_type || 'other',
    };
  }, [upcomingOrders]);

  const upcomingMeals = useMemo(() => {
    return (upcomingOrders || []).map((o) => ({
      id: o.id,
      date: new Date(o.scheduled_date).toISOString().slice(0, 10),
      time: new Date(o.scheduled_date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      restaurant: o.restaurant_name || 'Restaurant',
      mealType: o.meal_type || 'other',
    }));
  }, [upcomingOrders]);

  const metrics = useMemo(() => ([
    {
      title: 'Upcoming Meals',
      value: String(upcomingOrders?.length || 0),
      subtitle: 'Next 7 days',
      icon: 'Calendar',
      color: 'primary',
    },
    {
      title: 'Team Size',
      value: String(teamSize || 0),
      subtitle: 'Active members',
      icon: 'Users',
      color: 'success',
    },
    {
      title: 'Open Carts',
      value: String(openCartsCount || 0),
      subtitle: 'Not submitted',
      icon: 'ShoppingCart',
      color: 'accent',
    },
  ]), [upcomingOrders?.length, teamSize, openCartsCount]);

  const handleMetricClick = (metric) => {
    switch (metric?.title) {
      case 'Upcoming Meals': navigate('/calendar-order-scheduling');
        break;
      case 'Pending Polls': navigate('/meal-polling-system');
        break;
      case 'Monthly Spend': navigate('/expense-reports-analytics');
        break;
      default:
        break;
    }
  };

  const handleViewDetails = () => {
    navigate('/order-history-management');
  };

  const handleModifyOrder = () => {
    navigate('/calendar-order-scheduling');
  };

  const handleCancelOrder = () => navigate('/order-history-management');

  const handleDateClick = () => navigate('/calendar-order-scheduling');

  // Load dashboard data from DB
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!activeTeam?.id) { setLoading(false); return; }
      setErr(''); setLoading(true);
      try {
        const teamId = activeTeam.id;

        // Team size
        const { count: memberCount, error: memErr } = await supabase
          .from('team_members')
          .select('id', { count: 'exact', head: true })
          .eq('team_id', teamId);
        if (memErr) throw memErr;

        // Upcoming orders (next 7 days)
        const today = new Date();
        const end = new Date();
        end.setDate(today.getDate() + 7);
        const toISODate = (d) => d.toISOString().slice(0, 10);
        let oq = supabase
          .from('meal_orders')
          .select(`
            id, team_id, scheduled_date, order_status, fulfillment_method, meal_type,
            delivery_address_line1, delivery_city, delivery_state, delivery_zip,
            restaurant:restaurants ( name, address )
          `)
          .eq('team_id', teamId)
          .gte('scheduled_date', toISODate(today))
          .lte('scheduled_date', toISODate(end))
          .in('order_status', ['scheduled','confirmed'])
          .order('scheduled_date', { ascending: true });
        const { data: ordersData, error: ordersErr } = await oq;
        if (ordersErr) throw ordersErr;
        const normalized = (ordersData || []).map((row) => ({
          id: row.id,
          scheduled_date: row.scheduled_date,
          order_status: row.order_status,
          fulfillment_method: row.fulfillment_method,
          meal_type: row.meal_type || null,
          delivery_address_line1: row.delivery_address_line1,
          delivery_city: row.delivery_city,
          delivery_state: row.delivery_state,
          delivery_zip: row.delivery_zip,
          restaurant_name: row.restaurant?.name || 'Restaurant',
          restaurant_address: row.restaurant?.address || '',
        }));

        // Open carts count
        let openCarts = 0;
        try {
          const list = await cartDbService.listOpenCarts(teamId);
          openCarts = Array.isArray(list) ? list.length : 0;
        } catch {}

        if (!cancelled) {
          setTeamSize(memberCount || 0);
          setUpcomingOrders(normalized);
          setOpenCartsCount(openCarts);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load dashboard data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [activeTeam?.id]);

  // If user profile is still loading, show a loading message
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading user data...</p>
      </div>
    );
  }

  // Fallback if userProfile is null (e.g., not logged in)
  if (!userProfile) {
    return <Navigate to="/login-registration" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {userProfile.first_name}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your team meals today.
            </p>
          </div>

          {/* Top row: Metrics + Next meal + Quick actions (calendar below full-width) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {metrics?.map((metric, index) => (
                  <MetricsCard
                    key={index}
                    {...metric}
                    onClick={() => handleMetricClick(metric)}
                  />
                ))}
              </div>
              <NextMealWidget meal={nextMeal} />
            </div>
            <div>
              <QuickActions />
            </div>
          </div>

          {/* Calendar full-width */}
          <div className="mb-8">
            <UpcomingMealsCalendar
              upcomingMeals={upcomingMeals}
              onDateClick={handleDateClick}
              onMealClick={(meal) => navigate('/calendar-order-scheduling', { state: { openOrderId: meal.id } })}
            />
          </div>
          {err && (
            <div className="mt-6 text-sm text-destructive">{err}</div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DashboardHome;
