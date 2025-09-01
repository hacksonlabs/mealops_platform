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
import { downloadReceiptPdf, downloadReceiptsZip } from '../../utils/receipts';

const OrderHistoryManagement = () => {
  const navigate = useNavigate();
  const { user, userProfile, loading: loadingAuth, teams, activeTeam, loadingTeams } = useAuth();

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
  const teamId = activeTeam?.id ?? null;

  useEffect(() => {
    setOrders([]);
    setSelectedOrders([]);
  }, [teamId]);

  const fetchOrders = useCallback(async () => {
    if (!teamId) {
      setLoadingOrders(false);
      setOrders([]);
      return;
    }

    setLoadingOrders(true);
    setErrorOrders(null);

    let query = supabase
      .from('meal_orders')
      .select(`
        id,
        team_id,
        title,
        description,
        meal_type,
        scheduled_date,
        order_status,
        total_amount,
        api_order_id,
        restaurants:restaurants (id, name, address),
        saved_locations:saved_locations (id, name, address),
        payment_methods:payment_methods (id, card_name, last_four, is_default),
        order_items:order_items (
          id, user_id, team_member_id, item_name, quantity, price, special_instructions,
          user_profiles:user_profiles (first_name, last_name),
          team_members:team_members (full_name)
        )
      `)
      .eq('team_id', teamId)
      .order('scheduled_date', { ascending: false });

    if (filters.dateFrom) query = query.gte('scheduled_date', filters.dateFrom);
    if (filters.dateTo)   query = query.lte('scheduled_date', filters.dateTo);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching orders:', error.message);
      setErrorOrders('Failed to load orders.');
      setOrders([]);
    } else {
      const transformedOrders = (data || []).map(order => {
        // unique attendees by user_id
        const uniqueUsers = new Map();
        (order.order_items || []).forEach((it) => {
          const key = it.team_member_id || it.user_id || it.id;
          if (!uniqueUsers.has(key)) {
            const name =
              it.team_members?.full_name ??
              (it.user_profiles ? `${it.user_profiles.first_name} ${it.user_profiles.last_name}` : 'Team Member');
            uniqueUsers.set(key, name);
          }
        });

        return {
          id: order.id,
          date: order.scheduled_date,
          restaurant: order.restaurants?.name || 'Unknown Restaurant',
          mealType: (() => {
            if (order.meal_type) return order.meal_type; // enum from DB
            const haystack = `${order.title ?? ''} ${order.description ?? ''}`.toLowerCase();
            if (/\bbreakfast\b/.test(haystack)) return 'breakfast';
            if (/\blunch\b/.test(haystack))     return 'lunch';
            if (/\bdinner\b/.test(haystack))    return 'dinner';
            if (/\bsnacks?\b/.test(haystack))   return 'snack';
            return 'other';
          })(),
          location: order.saved_locations?.name || 'Unknown Location',
          attendees: uniqueUsers.size,
          totalCost: Number(order.total_amount) || 0,
          status: order.order_status,
          orderNumber: order.api_order_id || `ORD-${String(order.id).substring(0, 8)}`,
          teamMembers: Array.from(uniqueUsers.values()),
          paymentMethod: order.payment_methods
            ? `${order.payment_methods.card_name} (**** ${order.payment_methods.last_four})`
            : '—',
          originalOrderData: order
        };
      });

      setOrders(transformedOrders);
    }
    setLoadingOrders(false);
  }, [teamId, activeTab, filters]);

  useEffect(() => {
    if (!teamId) return;
    fetchOrders();
    const channel = supabase
      .channel(`order_history_changes_${teamId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_orders',
          filter: `team_id=eq.${teamId}`
        },
        () => fetchOrders()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, fetchOrders]);

  const tabs = [
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', count: orders?.filter(o => ['scheduled','pending_confirmation','preparing','out_for_delivery'].includes(o.status))?.length },
    { id: 'completed', label: 'Completed', icon: 'CheckCircle', count: orders?.filter(o => o?.status === 'completed')?.length },
    { id: 'cancelled', label: 'Cancelled', icon: 'XCircle', count: orders?.filter(o => ['cancelled','failed'].includes(o.status))?.length },
    { id: 'all', label: 'All', icon: 'ListChecks', count: orders?.length }
  ];

  const getFilteredOrders = () => {
    let filtered = orders;
    if (activeTab === 'scheduled') {
      filtered = filtered?.filter(o => ['scheduled','pending_confirmation','preparing','out_for_delivery'].includes(o.status));
    } else if (activeTab === 'completed') {
      filtered = filtered?.filter(o => o.status === 'completed');
    } else if (activeTab === 'cancelled') {
      filtered = filtered?.filter(o => ['cancelled','failed'].includes(o.status));
    }

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
      filtered = filtered?.filter(order => new Date(order.date) >= new Date(filters.dateFrom));
    }
    if (filters?.dateTo) {
      filtered = filtered?.filter(order => new Date(order.date) <= new Date(filters.dateTo));
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
    if (isSelected) setSelectedOrders([...selectedOrders, orderId]);
    else setSelectedOrders(selectedOrders?.filter(id => id !== orderId));
  };

  const handleSelectAll = (isSelected) => {
    if (isSelected) setSelectedOrders(filteredOrders?.map(order => order?.id));
    else setSelectedOrders([]);
  };

  const handleOrderAction = async (action, order) => {
    switch (action) {
      case 'view':
        setSelectedOrder(order?.originalOrderData);
        setIsDetailModalOpen(true);
        break;
      case 'modify':
        navigate('/calendar-order-scheduling', { state: { editOrder: order?.originalOrderData } });
        break;
      case 'cancel':
        try {
          const { error } = await supabase
            .from('meal_orders')
            .update({ order_status: 'cancelled' })
            .eq('id', order?.id);
          if (error) throw error;
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
        try {
          await downloadReceiptPdf(order?.id);
        } catch (err) {
          console.error('Failed to download receipt:', err);
        }
        break;
      default:
        break;
    }
  };

  const handleBulkAction = async (action, orderIds) => {
    switch (action) {
      case 'download-receipts':
        try {
          if (!orderIds?.length) return;
          await downloadReceiptsZip(orderIds);
        } catch (err) {
          console.error('Failed to bulk download receipts:', err);
        }
        break;
      case 'export-csv':
        setIsExportModalOpen(true);
        break;
      case 'generate-report':
        navigate('/expense-reports-analytics', { state: { selectedOrders: orderIds } });
        break;
      case 'send-summary':
        // TODO
        break;
      case 'cancel-orders':
        try {
          const { error } = await supabase
            .from('meal_orders')
            .update({ order_status: 'cancelled' })
            .in('id', orderIds);
          if (error) throw error;
          setSelectedOrders([]);
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
    // TODO
  };

  const handleClearSelection = () => {
    setSelectedOrders([]);
  };

  const totalInTab = (orders ?? []).filter(o => {
    if (activeTab === 'scheduled') return ['scheduled','pending_confirmation','preparing','out_for_delivery'].includes(o.status);
    if (activeTab === 'completed')  return o.status === 'completed';
    if (activeTab === 'cancelled')  return ['cancelled','failed'].includes(o.status);
    return true; // 'all'
  }).length;

  if (loadingAuth || loadingTeams || loadingOrders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="Loader" className="animate-spin text-primary" size={48} />
        <p className="ml-3 text-lg text-foreground">Loading orders...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-red-600">
        <p className="text-lg">Please log in to view order history.</p>
      </div>
    );
  }

  if (errorOrders) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-red-600">
        <p className="text-lg">Error: {errorOrders}</p>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        <div className="space-y-3 text-center">
          <p className="text-lg">No active team yet.</p>
          {teams?.length > 0 && (
            <p className="text-sm">Use the team switcher to pick one.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
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
                {/* <Button
                  variant="outline"
                  onClick={() => setIsExportModalOpen(true)}
                  iconName="Download"
                  iconPosition="left"
                >
                  Export Data
                </Button> */}
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
                Showing {filteredOrders?.length} of {totalInTab} orders
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