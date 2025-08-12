import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import MetricsCard from './components/MetricsCard';
import { NextMealWidget } from './components/NextMealWidget';
import ActivityFeed from './components/ActivityFeed';
import QuickActions from './components/QuickActions';
import UpcomingMealsCalendar from './components/UpcomingMealsCalendar';

const DashboardHome = () => {
  const navigate = useNavigate();
  const [user] = useState({
    name: "Coach Sarah Johnson",
    email: "sarah.johnson@athletics.edu",
    role: "Head Coach"
  });

  // Mock data for dashboard metrics
  const [metrics] = useState([
    {
      title: "Upcoming Meals",
      value: "3",
      subtitle: "Next 7 days",
      icon: "Calendar",
      color: "primary",
      trend: "up",
      trendValue: "+1 from last week"
    },
    {
      title: "Pending Polls",
      value: "2",
      subtitle: "Awaiting responses",
      icon: "Vote",
      color: "warning",
      trend: "neutral",
      trendValue: "Same as last week"
    },
    {
      title: "Team Size",
      value: "28",
      subtitle: "Active members",
      icon: "Users",
      color: "success",
      trend: "up",
      trendValue: "+2 new members"
    },
    {
      title: "Monthly Spend",
      value: "$2,847",
      subtitle: "December 2025",
      icon: "DollarSign",
      color: "accent",
      trend: "down",
      trendValue: "-12% vs last month"
    }
  ]);

  // Mock data for next scheduled meal
  const [nextMeal] = useState({
    id: 1,
    date: "2025-01-10",
    time: "18:30",
    restaurant: "Tony's Italian Bistro",
    location: "Downtown Sports Complex",
    status: "confirmed",
    attendees: 24,
    confirmedCount: 18,
    pendingCount: 6,
    specialInstructions: "Vegetarian options for 3 players. Team captain has nut allergy - please ensure no cross-contamination."
  });

  // Mock data for recent activities
  const [activities] = useState([
    {
      id: 1,
      type: "poll_completed",
      title: "Restaurant Poll Completed",
      description: "Team voted for Friday dinner location",
      timestamp: new Date(Date.now() - 300000), // 5 minutes ago
      details: "Tony's Italian Bistro won with 18 votes (64%). Pizza Palace got 8 votes (29%), and Burger Junction got 2 votes (7%).",
      actionRequired: false
    },
    {
      id: 2,
      type: "order_confirmed",
      title: "Order Confirmed",
      description: "Thursday lunch order confirmed for 22 attendees",
      timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
      details: "Confirmed with Healthy Eats Cafe. Total cost: $284. Pickup scheduled for 12:00 PM. Contact: (555) 123-4567",
      actionRequired: false
    },
    {
      id: 3,
      type: "team_member_added",
      title: "New Team Member Added",
      description: "Marcus Thompson joined as Assistant Coach",
      timestamp: new Date(Date.now() - 3600000), // 1 hour ago
      details: "Added with email marcus.thompson@athletics.edu. Role: Assistant Coach. Dietary restrictions: None.",
      actionRequired: false
    },
    {
      id: 4,
      type: "poll_created",
      title: "New Poll Created",
      description: "Weekend meal preferences poll is live",
      timestamp: new Date(Date.now() - 7200000), // 2 hours ago
      details: "Poll expires on January 9th at 5:00 PM. Options include: Mediterranean Grill, Taco Fiesta, and Sandwich Station.",
      actionRequired: true,
      actionText: "View Poll"
    },
    {
      id: 5,
      type: "payment_processed",
      title: "Payment Processed",
      description: "Tuesday dinner payment completed",
      timestamp: new Date(Date.now() - 86400000), // 1 day ago
      details: "Payment of $312.50 processed successfully. Receipt sent to accounting@athletics.edu. Transaction ID: TXN-2025-0107-001",
      actionRequired: false
    }
  ]);

  // Mock data for upcoming meals
  const [upcomingMeals] = useState([
    {
      id: 1,
      date: "2025-01-10",
      time: "6:30 PM",
      restaurant: "Tony's Italian Bistro"
    },
    {
      id: 2,
      date: "2025-01-12",
      time: "12:00 PM",
      restaurant: "Healthy Eats Cafe"
    },
    {
      id: 3,
      date: "2025-01-15",
      time: "7:00 PM",
      restaurant: "Mediterranean Grill"
    },
    {
      id: 4,
      date: "2025-01-18",
      time: "1:00 PM",
      restaurant: "Taco Fiesta"
    },
    {
      id: 5,
      date: "2025-01-22",
      time: "6:00 PM",
      restaurant: "Burger Junction"
    }
  ]);

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

  const handleCancelOrder = () => {
    // Mock cancel functionality
    alert('Order cancellation functionality would be implemented here');
  };

  const handleDateClick = (day, month) => {
    navigate('/calendar-order-scheduling');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={user} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Welcome back, {user?.name?.split(' ')?.[1]}!
            </h1>
            <p className="text-muted-foreground">
              Here's what's happening with your team meals today.
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics?.map((metric, index) => (
              <MetricsCard
                key={index}
                {...metric}
                onClick={() => handleMetricClick(metric)}
              />
            ))}
          </div>

          {/* Next Meal Widget */}
          <div className="mb-8">
            <NextMealWidget
              meal={nextMeal}
              onViewDetails={handleViewDetails}
              onModifyOrder={handleModifyOrder}
              onCancel={handleCancelOrder}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Activity Feed - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <ActivityFeed activities={activities} />
            </div>

            {/* Quick Actions - Takes 1 column on large screens */}
            <div className="lg:col-span-1">
              <QuickActions />
            </div>
          </div>

          {/* Calendar Widget */}
          <div className="max-w-md mx-auto lg:max-w-none">
            <UpcomingMealsCalendar
              upcomingMeals={upcomingMeals}
              onDateClick={handleDateClick}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardHome;