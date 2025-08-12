import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import OrderFilters from './components/OrderFilters';
import OrderTable from './components/OrderTable';
import OrderDetailModal from './components/OrderDetailModal';
import BulkActions from './components/BulkActions';
import ExportModal from './components/ExportModal';

const OrderHistoryManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('scheduled');
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    vendor: '',
    location: '',
    teamMembers: [],
    minCost: '',
    maxCost: '',
    search: ''
  });

  // Mock user data
  const currentUser = {
    name: 'Coach Johnson',
    email: 'coach.johnson@athletics.edu',
    role: 'Head Coach'
  };

  // Mock orders data
  const allOrders = [
    {
      id: 1,
      date: '2025-01-15T12:00:00',
      restaurant: 'Chipotle Mexican Grill',
      mealType: 'lunch',
      location: 'Training Facility',
      attendees: 8,
      totalCost: 89.52,
      status: 'scheduled',
      orderNumber: 'ORD-2025-001',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis', 'Jordan Smith', 'Taylor Brown', 'Casey Wilson']
    },
    {
      id: 2,
      date: '2025-01-12T18:30:00',
      restaurant: 'Olive Garden',
      mealType: 'dinner',
      location: 'Team Hotel',
      attendees: 12,
      totalCost: 186.75,
      status: 'completed',
      orderNumber: 'ORD-2025-002',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis', 'Jordan Smith']
    },
    {
      id: 3,
      date: '2025-01-10T07:30:00',
      restaurant: 'Panera Bread',
      mealType: 'breakfast',
      location: 'Away Venue',
      attendees: 6,
      totalCost: 67.89,
      status: 'completed',
      orderNumber: 'ORD-2025-003',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis', 'Jordan Smith']
    },
    {
      id: 4,
      date: '2025-01-08T13:00:00',
      restaurant: 'Subway',
      mealType: 'lunch',
      location: 'Home Stadium',
      attendees: 10,
      totalCost: 95.40,
      status: 'cancelled',
      orderNumber: 'ORD-2025-004',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis']
    },
    {
      id: 5,
      date: '2025-01-20T19:00:00',
      restaurant: 'Pizza Hut',
      mealType: 'dinner',
      location: 'Conference Center',
      attendees: 15,
      totalCost: 234.60,
      status: 'scheduled',
      orderNumber: 'ORD-2025-005',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis', 'Jordan Smith', 'Taylor Brown', 'Casey Wilson']
    },
    {
      id: 6,
      date: '2025-01-05T12:30:00',
      restaurant: 'Local Sports Deli',
      mealType: 'lunch',
      location: 'Training Facility',
      attendees: 7,
      totalCost: 78.25,
      status: 'completed',
      orderNumber: 'ORD-2025-006',
      teamMembers: ['Coach Johnson', 'Sarah Williams', 'Mike Chen', 'Alex Rodriguez', 'Emma Davis', 'Jordan Smith', 'Taylor Brown']
    }
  ];

  const tabs = [
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', count: allOrders?.filter(o => o?.status === 'scheduled')?.length },
    { id: 'completed', label: 'Completed', icon: 'CheckCircle', count: allOrders?.filter(o => o?.status === 'completed')?.length },
    { id: 'cancelled', label: 'Cancelled', icon: 'XCircle', count: allOrders?.filter(o => o?.status === 'cancelled')?.length }
  ];

  // Filter orders based on active tab and filters
  const getFilteredOrders = () => {
    let filtered = allOrders?.filter(order => order?.status === activeTab);

    // Apply filters
    if (filters?.search) {
      const searchLower = filters?.search?.toLowerCase();
      filtered = filtered?.filter(order =>
        order?.restaurant?.toLowerCase()?.includes(searchLower) ||
        order?.location?.toLowerCase()?.includes(searchLower) ||
        order?.orderNumber?.toLowerCase()?.includes(searchLower) ||
        order?.teamMembers?.some(member => member?.toLowerCase()?.includes(searchLower))
      );
    }

    if (filters?.vendor) {
      filtered = filtered?.filter(order => 
        order?.restaurant?.toLowerCase()?.includes(filters?.vendor?.toLowerCase())
      );
    }

    if (filters?.location) {
      filtered = filtered?.filter(order => 
        order?.location?.toLowerCase()?.includes(filters?.location?.toLowerCase())
      );
    }

    if (filters?.dateFrom) {
      filtered = filtered?.filter(order => 
        new Date(order.date) >= new Date(filters.dateFrom)
      );
    }

    if (filters?.dateTo) {
      filtered = filtered?.filter(order => 
        new Date(order.date) <= new Date(filters.dateTo)
      );
    }

    if (filters?.minCost) {
      filtered = filtered?.filter(order => order?.totalCost >= parseFloat(filters?.minCost));
    }

    if (filters?.maxCost) {
      filtered = filtered?.filter(order => order?.totalCost <= parseFloat(filters?.maxCost));
    }

    return filtered;
  };

  const filteredOrders = getFilteredOrders();

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedOrders([]);
  };

  const handleOrderSelect = (orderId, isSelected) => {
    if (isSelected) {
      setSelectedOrders([...selectedOrders, orderId]);
    } else {
      setSelectedOrders(selectedOrders?.filter(id => id !== orderId));
    }
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) {
      setSelectedOrders(filteredOrders?.map(order => order?.id));
    } else {
      setSelectedOrders([]);
    }
  };

  const handleOrderAction = (action, order) => {
    switch (action) {
      case 'view':
        setSelectedOrder(order);
        setIsDetailModalOpen(true);
        break;
      case 'modify':
        navigate('/calendar-order-scheduling', { state: { editOrder: order } });
        break;
      case 'cancel':
        // Handle order cancellation
        console.log('Cancelling order:', order?.id);
        break;
      case 'repeat': navigate('/calendar-order-scheduling', { state: { repeatOrder: order } });
        break;
      case 'copy': navigate('/calendar-order-scheduling', { state: { copyOrder: order } });
        break;
      case 'receipt':
        // Handle receipt download
        console.log('Downloading receipt for order:', order?.id);
        break;
      default:
        break;
    }
  };

  const handleBulkAction = (action, orderIds) => {
    console.log('Executing bulk action:', action, 'on orders:', orderIds);
    
    switch (action) {
      case 'download-receipts':
        // Handle bulk receipt download
        break;
      case 'export-csv':
        setIsExportModalOpen(true);
        break;
      case 'generate-report': navigate('/expense-reports-analytics', { state: { selectedOrders: orderIds } });
        break;
      case 'send-summary':
        // Handle email summary
        break;
      case 'cancel-orders':
        // Handle bulk cancellation
        break;
      default:
        break;
    }
  };

  const handleExport = (exportConfig) => {
    console.log('Exporting with config:', exportConfig);
    // Handle export logic here
  };

  const handleClearSelection = () => {
    setSelectedOrders([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={currentUser} notifications={3} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">
                  Order History & Management
                </h1>
                <p className="text-muted-foreground mt-2">
                  Track, manage, and analyze your team's meal orders
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => setIsExportModalOpen(true)}
                  iconName="Download"
                  iconPosition="left"
                >
                  Export Data
                </Button>
                <Button
                  onClick={() => navigate('/calendar-order-scheduling')}
                  iconName="Plus"
                  iconPosition="left"
                >
                  New Order
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-border">
              <nav className="-mb-px flex space-x-8">
                {tabs?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => handleTabChange(tab?.id)}
                    className={`
                      flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-athletic
                      ${activeTab === tab?.id
                        ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                      }
                    `}
                  >
                    <Icon name={tab?.icon} size={16} />
                    <span>{tab?.label}</span>
                    <span className={`
                      inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full
                      ${activeTab === tab?.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                      }
                    `}>
                      {tab?.count}
                    </span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Filters */}
          <OrderFilters
            filters={filters}
            onFiltersChange={setFilters}
            isCollapsed={isFiltersCollapsed}
            onToggleCollapse={() => setIsFiltersCollapsed(!isFiltersCollapsed)}
            resultCount={filteredOrders?.length}
          />

          {/* Bulk Actions */}
          <BulkActions
            selectedOrders={selectedOrders}
            orders={filteredOrders}
            onBulkAction={handleBulkAction}
            onClearSelection={handleClearSelection}
          />

          {/* Orders Table */}
          <OrderTable
            orders={filteredOrders}
            selectedOrders={selectedOrders}
            onOrderSelect={handleOrderSelect}
            onSelectAll={handleSelectAll}
            onOrderAction={handleOrderAction}
            activeTab={activeTab}
          />

          {/* Pagination */}
          {filteredOrders?.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Showing {filteredOrders?.length} of {allOrders?.filter(o => o?.status === activeTab)?.length} orders
              </div>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled iconName="ChevronLeft">
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled iconName="ChevronRight">
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
      {/* Modals */}
      <OrderDetailModal
        order={selectedOrder}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedOrder(null);
        }}
        onAction={handleOrderAction}
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExport}
        selectedOrders={selectedOrders}
        totalOrders={allOrders?.length}
      />
    </div>
  );
};

export default OrderHistoryManagement;