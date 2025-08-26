import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import OrderFilters from './components/OrderFilters';
import OrderTable from './components/OrderTable';
import OrderDetailModal from './components/OrderDetailModal';
import BulkActions from './components/BulkActions';
import ExportModal from './components/ExportModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

const OrderHistoryManagement = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: loadingAuth } = useAuth(); 
  
  const [teamId, setTeamId] = useState(null);
  const [loadingTeamId, setLoadingTeamId] = useState(true);
  const [errorTeamId, setErrorTeamId] = useState(null);

  const [activeTab, setActiveTab] = useState('scheduled');
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [errorOrders, setErrorOrders] = useState(null);

  const [selectedOrders, setSelectedOrders] = useState([]);
  const [isFiltersCollapsed, setIsFiltersCollapsed] = useState(true);
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

  // Fetch the teamId for the current user, mirroring the TeamMembersManagement logic
  useEffect(() => {
    const fetchUserTeamId = async () => {
      if (user?.id) {
        setLoadingTeamId(true);
        setErrorTeamId(null);
        try {
          // Query the 'teams' table to find the user's team(s)
          const { data, error } = await supabase
            .from('teams')
            .select('id')
            .eq('coach_id', user.id)
            .order('created_at', { ascending: false }) // Order to get a consistent primary team
            .limit(1); // We only need one teamId for now

          if (error) {
            throw error;
          }

          if (data && data.length > 0) {
            setTeamId(data[0].id); // Set the teamId from the fetched data
          } else {
            setTeamId(null);
            console.warn('User is not associated with any team.');
          }
        } catch (error) {
          console.error('Error fetching team ID:', error.message);
          setErrorTeamId('Failed to retrieve team information.');
          setTeamId(null);
        } finally {
          setLoadingTeamId(false);
        }
      } else if (!loadingAuth) {
        setTeamId(null);
        setLoadingTeamId(false);
      }
    };

    fetchUserTeamId();
  }, [user?.id, loadingAuth]);


  // Function to fetch orders from Supabase
  const fetchOrders = useCallback(async () => {
    if (!teamId) { // Only fetch if teamId is available
      setLoadingOrders(false);
      setOrders([]);
      return;
    }

    setLoadingOrders(true);
    setErrorOrders(null);

    // Initial query for meal_orders
    let query = supabase
      .from('meal_orders')
      .select(`
        id,
        title,
        scheduled_date,
        description,
        order_status,
        total_amount,
        api_order_id,
        restaurants (id, name, address),
        saved_locations (id, name, address),
        order_items (
          id,
          user_id,
          item_name,
          quantity,
          price,
          special_instructions,
          user_profiles (first_name, last_name)
        )
      `)
      .eq('team_id', teamId); // Filter by team_id


    console.log(query);
    // Apply filters based on current state
    if (filters.dateFrom) {
      query = query.gte('scheduled_date', filters.dateFrom);
    }
    if (filters.dateTo) {
      query = query.lte('scheduled_date', filters.dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error.message);
      setErrorOrders('Failed to load orders.');
      setOrders([]);
    } else {
      // Transform Supabase data to match the component's expected structure
      const transformedOrders = data.map(order => ({
        id: order.id,
        date: order.scheduled_date,
        restaurant: order.restaurants?.name || 'Unknown Restaurant',
        mealType: order.description?.toLowerCase()?.includes('breakfast') ? 'breakfast' :
                  order.description?.toLowerCase()?.includes('lunch') ? 'lunch' :
                  order.description?.toLowerCase()?.includes('dinner') ? 'dinner' : 'meal',
        location: order.saved_locations?.name || 'Unknown Location',
        attendees: order.order_items?.length || 0,
        totalCost: parseFloat(order.total_amount) || 0,
        status: order.order_status,
        orderNumber: order.api_order_id || `ORD-${order.id.substring(0, 8)}`,
        teamMembers: order.order_items?.map(item => 
          item.user_profiles ? `${item.user_profiles.first_name} ${item.user_profiles.last_name}` : 'Unknown Member'
        ),
        originalOrderData: order
      }));
      setOrders(transformedOrders);
    }
    setLoadingOrders(false);
  }, [teamId, filters]);

  // Use a real-time subscription for orders
  useEffect(() => {
    if (!teamId) return; // Only subscribe if teamId is available

    fetchOrders(); // Initial fetch

    const channel = supabase
      .channel('order_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'meal_orders',
          filter: `team_id=eq.${teamId}` // Filter real-time changes by team_id
        },
        payload => {
          console.log('Change received!', payload);
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchOrders]);
  
  // Define the tabs array here
  const tabs = [
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', count: orders?.filter(o => o?.status === 'scheduled' || o?.status === 'pending_confirmation' || o?.status === 'preparing' || o?.status === 'out_for_delivery')?.length },
    { id: 'completed', label: 'Completed', icon: 'CheckCircle', count: orders?.filter(o => o?.status === 'completed')?.length },
    { id: 'cancelled', label: 'Cancelled', icon: 'XCircle', count: orders?.filter(o => o?.status === 'cancelled' || o?.status === 'failed')?.length }
  ];


  // Filter orders based on active tab and filters
  const getFilteredOrders = () => {
    let filtered = orders?.filter(order => {
      if (activeTab === 'scheduled') {
        return ['scheduled', 'pending_confirmation', 'preparing', 'out_for_delivery'].includes(order.status);
      } else if (activeTab === 'completed') {
        return order.status === 'completed';
      } else if (activeTab === 'cancelled') {
        return ['cancelled', 'failed'].includes(order.status);
      }
      return false;
    });

    // Apply client-side filters
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

  const handleOrderAction = async (action, order) => {
    switch (action) {
      case 'view':
        setSelectedOrder(order?.originalOrderData); // Pass original DB data to modal
        setIsDetailModalOpen(true);
        break;
      case 'modify':
        // Navigate to scheduling page with the original order data for editing
        navigate('/calendar-order-scheduling', { state: { editOrder: order?.originalOrderData } });
        break;
      case 'cancel':
        // Handle order cancellation (update status in DB)
        try {
          const { error } = await supabase
            .from('meal_orders')
            .update({ order_status: 'cancelled' })
            .eq('id', order?.id);
          if (error) throw error;
          console.log('Order cancelled:', order?.id);
          // UI will auto-update due to real-time subscription
        } catch (error) {
          console.error('Error cancelling order:', error.message);
        }
        break;
      case 'repeat': 
        navigate('/calendar-order-scheduling', { state: { repeatOrder: order?.originalOrderData } });
        break;
      case 'copy': 
        navigate('/calendar-order-scheduling', { state: { copyOrder: order?.originalOrderData } });
        break;
      case 'receipt':
        console.log('Downloading receipt for order:', order?.id);
        // Implement receipt download logic here
        break;
      default:
        break;
    }
  };

  const handleBulkAction = async (action, orderIds) => {
    console.log('Executing bulk action:', action, 'on orders:', orderIds);
    
    switch (action) {
      case 'download-receipts':
        // Handle bulk receipt download
        break;
      case 'export-csv':
        setIsExportModalOpen(true);
        break;
      case 'generate-report': 
        navigate('/expense-reports-analytics', { state: { selectedOrders: orderIds } });
        break;
      case 'send-summary':
        // Handle email summary
        break;
      case 'cancel-orders':
        try {
          const { error } = await supabase
            .from('meal_orders')
            .update({ order_status: 'cancelled' })
            .in('id', orderIds);
          if (error) throw error;
          console.log('Bulk orders cancelled:', orderIds);
          setSelectedOrders([]); // Clear selection after action
        } catch (error) {
          console.error('Error bulk cancelling orders:', error.message);
        }
        break;
      default:
        break;
    }
  };

  const handleExport = (exportConfig) => {
    console.log('Exporting with config:', exportConfig);
    // Implement export logic here, potentially fetching data based on exportConfig
  };

  const handleClearSelection = () => {
    setSelectedOrders([]);
  };

  if (loadingAuth || loadingTeamId || loadingOrders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="Loader" className="animate-spin text-primary" size={48} />
        <p className="ml-3 text-lg text-foreground">Loading orders...</p>
      </div>
    );
  }

  // If user is not authenticated after loading, prompt login
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-red-600">
        <p className="text-lg">Please log in to view order history.</p>
      </div>
    );
  }

  // Handle errors specific to team ID fetching
  if (errorTeamId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-red-600">
        <p className="text-lg">Error loading team information: {errorTeamId}</p>
      </div>
    );
  }

  // Handle errors specific to order fetching
  if (errorOrders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-red-600">
        <p className="text-lg">Error: {errorOrders}</p>
      </div>
    );
  }

  // If no teamId is found (and no error occurred during fetch), inform the user
  if (!teamId) {
      return (
          <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
              <p className="text-lg">You are not associated with a team. Please contact your administrator.</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Use userProfile from your AuthContext for Header */}
      <Header user={userProfile} notifications={3} />
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
                Showing {filteredOrders?.length} of {orders?.filter(o => {
                  if (activeTab === 'scheduled') return ['scheduled', 'pending_confirmation', 'preparing', 'out_for_delivery'].includes(o.status);
                  if (activeTab === 'completed') return o.status === 'completed';
                  if (activeTab === 'cancelled') return ['cancelled', 'failed'].includes(o.status);
                  return false;
                })?.length} orders
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
        totalOrders={orders?.length}
      />
    </div>
  );
};

export default OrderHistoryManagement;