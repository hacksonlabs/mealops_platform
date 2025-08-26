import React, { useState, useEffect, useMemo } from 'react';
import Header from '../../components/ui/Header';
import CalendarHeader from './components/CalendarHeader';
import CalendarGrid from './components/CalendarGrid';
import TopPanel from './components/TopPanel';
import ScheduleMealModal from './components/ScheduleMealModal';
import OrderDetailsModal from './components/OrderDetailsModal';
import Button from '../../components/ui/Button';
import Icon from '../../components/AppIcon';

const CalendarOrderScheduling = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('twoWeeks');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    mealType: 'all',
    restaurant: 'all'
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // normalize so comparisons work
    return d;
  });

  // Mock data for orders
  const [orders, setOrders] = useState([
    {
      id: 1001,
      date: '2025-09-01T00:00:00.000Z',
      restaurant: 'Chipotle Mexican Grill',
      mealType: 'lunch',
      time: '12:30',
      attendees: 18,
      status: 'confirmed',
      notes: 'Extra guac for players, no spicy options',
      createdAt: '2025-08-28T10:30:00.000Z',
      members: [
        { id: 1, name: 'Marcus Johnson', role: 'Player' },
        { id: 2, name: 'Sarah Williams', role: 'Coach' }
      ]
    },
    {
      id: 1002,
      date: '2025-08-30T00:00:00.000Z',
      restaurant: 'Subway',
      mealType: 'lunch',
      time: '13:00',
      attendees: 22,
      status: 'scheduled',
      notes: 'Team meeting lunch - conference room setup needed',
      createdAt: '2025-08-29T14:20:00.000Z',
      members: []
    },
    {
      id: 1003,
      date: '2025-08-28T00:00:00.000Z',
      restaurant: 'Panera Bread',
      mealType: 'breakfast',
      time: '08:00',
      attendees: 15,
      status: 'scheduled',
      notes: 'Pre-game breakfast - light options preferred',
      createdAt: '2025-08-27T09:15:00.000Z',
      members: []
    },
    {
      id: 1004,
      date: '2025-08-20T00:00:00.000Z',
      restaurant: 'Olive Garden',
      mealType: 'dinner',
      time: '18:30',
      attendees: 25,
      status: 'confirmed',
      notes: 'Team celebration dinner - private dining room reserved',
      createdAt: '2025-08-19T16:45:00.000Z',
      members: []
    },
    {
      id: 1005,
      date: '2025-08-26T00:00:00.000Z',
      restaurant: 'Local Deli & Catering',
      mealType: 'lunch',
      time: '12:00',
      attendees: 20,
      status: 'completed',
      notes: 'Post-practice recovery meal',
      createdAt: '2025-08-25T11:30:00.000Z',
      members: []
    },
    {
      id: 1006,
      date: '2025-08-28T00:00:00.000Z',
      restaurant: 'Panda',
      mealType: 'lunch',
      time: '12:00',
      attendees: 20,
      status: 'confirmed',
      notes: 'Post-practice recovery meal',
      createdAt: '2025-08-25T11:30:00.000Z',
      members: []
    },
    {
      id: 1007,
      date: '2025-08-28T00:00:00.000Z',
      restaurant: 'Jamba',
      mealType: 'snack',
      time: '2:30',
      attendees: 20,
      status: 'confirmed',
      notes: 'Post-practice recovery meal',
      createdAt: '2025-08-25T11:30:00.000Z',
      members: []
    },
    {
      id: 1008,
      date: '2025-08-28T00:00:00.000Z',
      restaurant: 'Ikes',
      mealType: 'lunch',
      time: '1:00',
      attendees: 20,
      status: 'confirmed',
      notes: 'Post-practice recovery meal',
      createdAt: '2025-08-25T11:30:00.000Z',
      members: []
    }
  ]);

  // Mock team members data
  const teamMembers = [
    {
      id: 1,
      name: 'Marcus Johnson',
      role: 'Player',
      email: 'marcus.johnson@team.com',
      phone: '(555) 123-4567',
      allergies: 'Peanuts'
    },
    {
      id: 2,
      name: 'Sarah Williams',
      role: 'Coach',
      email: 'sarah.williams@team.com',
      phone: '(555) 234-5678',
      allergies: null
    },
    {
      id: 3,
      name: 'David Chen',
      role: 'Player',
      email: 'david.chen@team.com',
      phone: '(555) 345-6789',
      allergies: 'Dairy'
    },
    {
      id: 4,
      name: 'Emily Rodriguez',
      role: 'Assistant Coach',
      email: 'emily.rodriguez@team.com',
      phone: '(555) 456-7890',
      allergies: null
    },
    {
      id: 5,
      name: 'Michael Thompson',
      role: 'Player',
      email: 'michael.thompson@team.com',
      phone: '(555) 567-8901',
      allergies: 'Gluten'
    }
  ];

  // Mock saved templates
  const savedTemplates = [
    {
      id: 'template-1',
      name: 'Pre-Game Breakfast',
      restaurant: 'panera',
      mealType: 'breakfast',
      time: '08:00',
      members: [1, 2, 3, 4, 5],
      notes: 'Light breakfast before game day'
    },
    {
      id: 'template-2',
      name: 'Team Lunch Meeting',
      restaurant: 'chipotle',
      mealType: 'lunch',
      time: '12:30',
      members: [1, 2, 3, 4, 5],
      notes: 'Weekly team meeting with lunch'
    },
    {
      id: 'template-3',
      name: 'Post-Practice Dinner',
      restaurant: 'olive-garden',
      mealType: 'dinner',
      time: '18:00',
      members: [1, 2, 3, 4, 5],
      notes: 'Recovery meal after intense practice'
    }
  ];

  // ===== This Month (derived from currentDate + orders) =====
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd   = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const thisMonthOrders = orders.filter(o => {
    const d = new Date(o.date);
    return d >= monthStart && d <= monthEnd;
  });

  const getOrderCost = (o) =>
    Number(
      o.totalCost ??
      ((o.attendees || 0) * (o.costPerAttendee ?? 12))
    );

  // Financials for this month
  const monthStats = React.useMemo(() => {
    const totalMeals = thisMonthOrders.length;
    const totalSpent = thisMonthOrders.reduce((sum, o) => sum + getOrderCost(o), 0);
    const avgPerMeal = totalMeals ? totalSpent / totalMeals : 0;
    return { totalMeals, totalSpent, avgPerMeal };
  }, [thisMonthOrders]);


  // Filter orders based on current filters
  const filteredOrders = orders?.filter(order => {
    if (filters?.mealType !== 'all' && order?.mealType !== filters?.mealType) {
      return false;
    }
    if (filters?.restaurant !== 'all') {
      const restaurantMap = {
        'chipotle': 'Chipotle Mexican Grill',
        'subway': 'Subway',
        'panera': 'Panera Bread',
        'olive-garden': 'Olive Garden',
        'local-deli': 'Local Deli & Catering'
      };
      if (order?.restaurant !== restaurantMap?.[filters?.restaurant]) {
        return false;
      }
    }
    return true;
  });

  // Get upcoming meals (next 7 days)
  const upcomingMeals = orders?.filter(order => {
    const orderDate = new Date(order.date);
    const today = new Date();
    const nextWeek = new Date();
    nextWeek?.setDate(today?.getDate() + 7);
    return orderDate >= today && orderDate <= nextWeek && order?.status !== 'completed';
  })?.sort((a, b) => new Date(a.date) - new Date(b.date));

  const handleDateSelect = (date) => {
    setSelectedDate(date);
  };

  const handleTodayClick = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleScheduleNew = () => {
    setIsScheduleModalOpen(true);
  };

  const handleScheduleMeal = (orderData) => {
    setOrders(prev => [...prev, orderData]);
  };

  const handleOrderClick = (order) => {
    setSelectedOrder(order);
    setIsOrderDetailsModalOpen(true);
  };

  const handleQuickNewOrder = (date) => {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    setSelectedDate(d);
    setIsScheduleModalOpen(true);
  };

  const handleEditOrder = (order) => {
    // In a real app, this would open the edit modal with pre-filled data
    console.log('Edit order:', order);
  };

  const handleCancelOrder = (orderId) => {
    setOrders(prev => 
      prev?.map(order => 
        order?.id === orderId 
          ? { ...order, status: 'cancelled' }
          : order
      )
    );
  };

  const handleRepeatOrder = (order) => {
    // In a real app, this would open the schedule modal with pre-filled data
    setSelectedDate(new Date());
    setIsScheduleModalOpen(true);
  };

  const handleTemplateUse = (template) => {
    setSelectedDate(new Date());
    setIsScheduleModalOpen(true);
  };

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header user={{ name: 'Coach Johnson', email: 'coach@team.com' }} notifications={3} />
      <main className="pt-16">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">
                  Calendar & Order Scheduling
                </h1>
                <p className="text-muted-foreground mt-2">
                  Schedule and manage team meal orders with interactive calendar
                </p>
              </div>
              
              {!isMobile && (
                <Button
                  onClick={handleScheduleNew}
                  iconName="Plus"
                  iconSize={16}
                  size="lg"
                >
                  Schedule New Meal
                </Button>
              )}
            </div>
          </div>
          {/* Top Bar */}
          <div className="mb-6">
            {/* <SidebarPanel
              orientation="horizontal"
              selectedDate={selectedDate}
              upcomingMeals={upcomingMeals}
              savedTemplates={savedTemplates}
              onTemplateUse={handleTemplateUse}
              onScheduleNew={handleScheduleNew}
            /> */}
            <TopPanel
              orientation="horizontal"
              upcomingMeals={upcomingMeals}
              monthStats={monthStats}
              onScheduleNew={handleScheduleNew}
            />
          </div>

          {/* Calendar Header */}
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

          {/* Main Content */}
          <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-1'}`}>
            {/* Calendar Grid */}
            <div className={isMobile ? 'order-1' : 'lg:col-span-3'}>
              {isMobile ? (
                // Mobile Agenda View
                (<div className="space-y-4">
                  <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-heading font-semibold text-foreground">
                        Upcoming Meals
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleScheduleNew}
                        iconName="Plus"
                        iconSize={16}
                      >
                        Schedule
                      </Button>
                    </div>
                    
                    {upcomingMeals?.length > 0 ? (
                      <div className="space-y-3">
                        {upcomingMeals?.map(meal => (
                          <div
                            key={meal?.id}
                            className="p-4 border border-border rounded-md hover:bg-muted/50 transition-athletic cursor-pointer"
                            onClick={() => handleOrderClick(meal)}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-foreground">
                                  {meal?.restaurant}
                                </h4>
                                <p className="text-sm text-muted-foreground capitalize">
                                  {meal?.mealType}
                                </p>
                              </div>
                              <span className={`
                                text-xs px-2 py-1 rounded-full border font-medium
                                ${meal?.status === 'scheduled' ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-green-600 bg-green-50 border-green-200'}
                              `}>
                                {meal?.status}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                              <div className="flex items-center space-x-4">
                                <div className="flex items-center space-x-1">
                                  <Icon name="Calendar" size={14} />
                                  <span>
                                    {new Date(meal.date)?.toLocaleDateString('en-US', { 
                                      month: 'short', 
                                      day: 'numeric' 
                                    })}
                                  </span>
                                </div>
                                <div className="flex items-center space-x-1">
                                  <Icon name="Clock" size={14} />
                                  <span>{meal?.time}</span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Icon name="Users" size={14} />
                                <span>{meal?.attendees}</span>
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
                </div>)
              ) : (
                // Desktop Calendar View
                (<CalendarGrid
                  currentDate={currentDate}
                  selectedDate={selectedDate}
                  onDateSelect={handleDateSelect}
                  orders={filteredOrders}
                  viewMode={viewMode}
                  onOrderClick={handleOrderClick}
                  onNewOrder={handleQuickNewOrder}
                />)
              )}
            </div>
          </div>

          {/* Mobile Floating Action Button */}
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
      {/* Modals */}
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
    </div>
  );
};

export default CalendarOrderScheduling;