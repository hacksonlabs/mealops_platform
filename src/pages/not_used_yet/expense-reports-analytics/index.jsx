import React, { useState, useEffect } from 'react';
import Header from '../../../components/ui/Header';
import MetricsCard from './components/MetricsCard';
import FilterPanel from './components/FilterPanel';
import SpendByVendorChart from './components/SpendByVendorChart';
import SpendByLocationChart from './components/SpendByLocationChart';
import ExpenseTable from './components/ExpenseTable';
import ReceiptManagement from './components/ReceiptManagement';

const ExpenseReportsAnalytics = () => {
  const [filters, setFilters] = useState({
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    vendor: 'all',
    team: 'all',
    location: 'all',
    budgetThreshold: ''
  });

  const [selectedExpenses, setSelectedExpenses] = useState([]);
  const [expenses, setExpenses] = useState([]);

  // Mock user data
  const currentUser = {
    name: "Coach Johnson",
    email: "coach.johnson@athletics.edu"
  };

  // Mock metrics data
  const metricsData = [
    {
      title: "Total Meals",
      value: "342",
      subtitle: "This month",
      trend: "up",
      trendValue: "+12.5%",
      icon: "Utensils",
      iconColor: "text-primary"
    },
    {
      title: "Total Spend",
      value: "$18,450",
      subtitle: "January 2025",
      trend: "up",
      trendValue: "+8.2%",
      icon: "DollarSign",
      iconColor: "text-success"
    },
    {
      title: "Average per Meal",
      value: "$53.95",
      subtitle: "Per person",
      trend: "down",
      trendValue: "-2.1%",
      icon: "Calculator",
      iconColor: "text-accent"
    },
    {
      title: "Most Used Vendor",
      value: "Pizza Palace",
      subtitle: "28% of orders",
      trend: "up",
      trendValue: "+5.3%",
      icon: "Store",
      iconColor: "text-warning"
    }
  ];

  // Mock vendor spend data
  const vendorSpendData = [
    { name: 'Pizza Palace', value: 5200, total: 18450 },
    { name: 'Healthy Bites', value: 4100, total: 18450 },
    { name: 'Burger Barn', value: 3800, total: 18450 },
    { name: 'Taco Time', value: 2950, total: 18450 },
    { name: 'Sandwich Spot', value: 2400, total: 18450 }
  ];

  // Mock location spend data
  const locationSpendData = [
    { name: 'Home Stadium', value: 6800, orders: 45 },
    { name: 'Away Games', value: 5200, orders: 32 },
    { name: 'Training Facility', value: 3900, orders: 28 },
    { name: 'Team Hotel', value: 2550, orders: 18 }
  ];

  // Mock team member spend data
  const teamMemberSpendData = [
    { name: 'Varsity Football', value: 8900, orders: 58 },
    { name: 'JV Football', value: 4200, orders: 35 },
    { name: 'Basketball', value: 3100, orders: 22 },
    { name: 'Soccer', value: 2250, orders: 18 }
  ];

  // Mock expense data
  const mockExpenses = [
    {
      id: 1,
      date: '2025-01-28',
      time: '12:30 PM',
      vendor: 'Pizza Palace',
      orderType: 'Team Lunch',
      amount: 485,
      attendees: 25,
      location: 'Home Stadium'
    },
    {
      id: 2,
      date: '2025-01-27',
      time: '6:45 PM',
      vendor: 'Healthy Bites',
      orderType: 'Post-Game Meal',
      amount: 620,
      attendees: 28,
      location: 'Away Games'
    },
    {
      id: 3,
      date: '2025-01-26',
      time: '1:15 PM',
      vendor: 'Burger Barn',
      orderType: 'Training Meal',
      amount: 395,
      attendees: 22,
      location: 'Training Facility'
    },
    {
      id: 4,
      date: '2025-01-25',
      time: '7:30 PM',
      vendor: 'Taco Time',
      orderType: 'Team Dinner',
      amount: 540,
      attendees: 30,
      location: 'Team Hotel'
    },
    {
      id: 5,
      date: '2025-01-24',
      time: '11:45 AM',
      vendor: 'Sandwich Spot',
      orderType: 'Pre-Game Meal',
      amount: 320,
      attendees: 18,
      location: 'Away Games'
    },
    {
      id: 6,
      date: '2025-01-23',
      time: '2:00 PM',
      vendor: 'Pizza Palace',
      orderType: 'Team Meeting',
      amount: 275,
      attendees: 15,
      location: 'Training Facility'
    },
    {
      id: 7,
      date: '2025-01-22',
      time: '5:30 PM',
      vendor: 'Healthy Bites',
      orderType: 'Recovery Meal',
      amount: 445,
      attendees: 24,
      location: 'Home Stadium'
    },
    {
      id: 8,
      date: '2025-01-21',
      time: '12:00 PM',
      vendor: 'Burger Barn',
      orderType: 'Team Lunch',
      amount: 380,
      attendees: 20,
      location: 'Training Facility'
    }
  ];

  useEffect(() => {
    setExpenses(mockExpenses);
  }, []);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    // Filter logic would be implemented here
    console.log('Applying filters:', filters);
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      vendor: 'all',
      team: 'all',
      location: 'all',
      budgetThreshold: ''
    });
  };

  const handleVendorSegmentClick = (data) => {
    console.log('Vendor segment clicked:', data);
    // Implement drill-down functionality
  };

  const handleLocationDrillDown = (data) => {
    console.log('Location drill-down:', data);
    // Implement drill-down functionality
  };

  const handleExpenseSort = (field, direction) => {
    const sortedExpenses = [...expenses]?.sort((a, b) => {
      let aValue = a?.[field];
      let bValue = b?.[field];

      if (field === 'date') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (field === 'amount' || field === 'attendees') {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else {
        aValue = String(aValue)?.toLowerCase();
        bValue = String(bValue)?.toLowerCase();
      }

      if (direction === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setExpenses(sortedExpenses);
  };

  const handleExpenseSearch = (searchTerm) => {
    if (!searchTerm) {
      setExpenses(mockExpenses);
      return;
    }

    const filteredExpenses = mockExpenses?.filter(expense =>
      expense?.vendor?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      expense?.location?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
      expense?.orderType?.toLowerCase()?.includes(searchTerm?.toLowerCase())
    );

    setExpenses(filteredExpenses);
  };

  const handleBulkSelect = (selectedIds) => {
    setSelectedExpenses(selectedIds);
  };

  const handleReceiptDownload = (expenseIds) => {
    console.log('Downloading receipts for:', expenseIds);
    // Implement receipt download functionality
  };

  const handleBulkDownload = () => {
    console.log('Bulk PDF download initiated');
    // Implement bulk download functionality
  };

  const handleCsvExport = () => {
    console.log('CSV export initiated');
    // Implement CSV export functionality
  };

  const handleConcurIntegration = () => {
    console.log('Concur integration initiated');
    // Implement Concur integration
  };

  const handlePdfBundle = (bundleData) => {
    console.log('PDF bundle generation:', bundleData);
    // Implement PDF bundle generation
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} notifications={3} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Expense Reports & Analytics
            </h1>
            <p className="text-muted-foreground">
              Comprehensive spending insights and expense management for your athletic teams
            </p>
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metricsData?.map((metric, index) => (
              <MetricsCard
                key={index}
                title={metric?.title}
                value={metric?.value}
                subtitle={metric?.subtitle}
                trend={metric?.trend}
                trendValue={metric?.trendValue}
                icon={metric?.icon}
                iconColor={metric?.iconColor}
              />
            ))}
          </div>

          {/* Filter Panel */}
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            onApplyFilters={handleApplyFilters}
            onResetFilters={handleResetFilters}
          />

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <SpendByVendorChart
              data={vendorSpendData}
              onSegmentClick={handleVendorSegmentClick}
            />
            <SpendByLocationChart
              locationData={locationSpendData}
              teamMemberData={teamMemberSpendData}
              onDrillDown={handleLocationDrillDown}
            />
          </div>

          {/* Main Content Area */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Expense Table */}
            <div className="lg:col-span-3">
              <ExpenseTable
                expenses={expenses}
                onSort={handleExpenseSort}
                onSearch={handleExpenseSearch}
                onBulkSelect={handleBulkSelect}
                selectedItems={selectedExpenses}
                onReceiptDownload={handleReceiptDownload}
              />
            </div>

            {/* Receipt Management Sidebar */}
            <div className="lg:col-span-1">
              <ReceiptManagement
                onBulkDownload={handleBulkDownload}
                onCsvExport={handleCsvExport}
                onConcurIntegration={handleConcurIntegration}
                onPdfBundle={handlePdfBundle}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExpenseReportsAnalytics;