import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import OrderFilters from './components/OrderFilters';
import OrderTable from './components/OrderTable';
import OrderDetailModal from './components/OrderDetailModal';
import BulkActions from './components/BulkActions';
import ExportModal from './components/ExportModal';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { downloadReceiptPdf, downloadReceiptsZip } from '../../utils/receipts';
import { callCancelAPI } from '../../utils/ordersApiUtils';

const PAGE_SIZE = 6;
const SCHEDULED_STATUSES = ['scheduled', 'confirmed'];

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
  const [currentPage, setCurrentPage] = useState(0);
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
        id, team_id, title, description, meal_type, scheduled_date, order_status, fulfillment_method,
        total_amount, api_order_id,
        delivery_address_line1, delivery_city, delivery_state, delivery_zip, delivery_instructions,

        restaurant:restaurants ( id, name, address ),
        payment_method:payment_methods ( id, card_name, last_four, is_default ),

        meal_items:meal_order_items (
          id, name, quantity, product_marked_price_cents, notes,
          team_member:team_members ( id, full_name )
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
        const items = order.meal_items || [];

        // unique assignees (by team member)
        const uniqNames = new Set(
          items.map(i => i?.team_member?.full_name).filter(Boolean)
        );

        const attendees =
          uniqNames.size > 0
            ? uniqNames.size
            : items.reduce((sum, it) => sum + (it?.quantity ?? 1), 0);

        const locationStr = [
          order?.delivery_address_line1,
          order?.delivery_city,
          order?.delivery_state,
          order?.delivery_zip
        ].filter(Boolean).join(', ');

        return {
          id: order.id,
          date: order.scheduled_date,
          restaurant: order.restaurant?.name || 'Unknown Restaurant',
          mealType: (() => {
            if (order.meal_type) return order.meal_type;
            const haystack = `${order.title ?? ''} ${order.description ?? ''}`.toLowerCase();
            if (/\bbreakfast\b/.test(haystack)) return 'breakfast';
            if (/\blunch\b/.test(haystack))     return 'lunch';
            if (/\bdinner\b/.test(haystack))    return 'dinner';
            if (/\bsnacks?\b/.test(haystack))   return 'snack';
            return 'other';
          })(),
          location: locationStr || '—',
          attendees,
          totalCost: Number(order.total_amount) || 0,
          status: order.order_status,
          orderNumber: order.api_order_id || `ORD-${String(order.id).substring(0, 8)}`,
          teamMembers: Array.from(uniqNames),
          paymentMethod: order.payment_method
            ? `${order.payment_method.card_name} (**** ${order.payment_method.last_four})`
            : '—',
          fulfillmentMethod: order.fulfillment_method || '',
          originalOrderData: order
        };
      });

      setOrders(transformedOrders);
    }
    setLoadingOrders(false);
  }, [teamId, filters]);

  const fetchOrdersRef = useRef(() => {});
  useEffect(() => { fetchOrdersRef.current = fetchOrders; }, [fetchOrders]);

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
        () => fetchOrdersRef.current()
      )
      .subscribe();

    const customHandler = () => fetchOrdersRef.current();
    window.addEventListener('orders:refresh', customHandler);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('orders:refresh', customHandler);
    };
  }, [teamId]);

  const tabs = [
    { id: 'scheduled', label: 'Scheduled', icon: 'Calendar', count: orders?.filter(o => SCHEDULED_STATUSES.includes(o.status))?.length },
    { id: 'completed', label: 'Completed', icon: 'CheckCircle', count: orders?.filter(o => o?.status === 'completed')?.length },
    { id: 'cancelled', label: 'Cancelled', icon: 'XCircle', count: orders?.filter(o => ['cancelled','failed'].includes(o.status))?.length },
    { id: 'all', label: 'All', icon: 'ListChecks', count: orders?.length }
  ];

  const getFilteredOrders = () => {
    let filtered = orders;
    if (activeTab === 'scheduled') {
      filtered = filtered?.filter(o => SCHEDULED_STATUSES.includes(o.status));
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
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const adjustedPage = Math.min(currentPage, totalPages - 1);
  const paginatedOrders = filteredOrders.slice(adjustedPage * PAGE_SIZE, adjustedPage * PAGE_SIZE + PAGE_SIZE);
  const pageStart = filteredOrders.length === 0 ? 0 : adjustedPage * PAGE_SIZE + 1;
  const pageEnd = adjustedPage * PAGE_SIZE + paginatedOrders.length;
  const canGoPrev = adjustedPage > 0;
  const canGoNext = adjustedPage < totalPages - 1 && filteredOrders.length > 0;

  useEffect(() => {
    if (currentPage !== adjustedPage) {
      setCurrentPage(adjustedPage);
    }
  }, [adjustedPage, currentPage, filteredOrders.length]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSelectedOrders([]);
    setCurrentPage(0);
  };

  const handleOrderSelect = (orderId, isSelected) => {
    if (isSelected) setSelectedOrders([...selectedOrders, orderId]);
    else setSelectedOrders(selectedOrders?.filter(id => id !== orderId));
  };

  const handleSelectAll = (isSelected, visibleOrders) => {
    const ids = (visibleOrders || []).map(order => order?.id).filter(Boolean);
    if (isSelected) {
      const merged = new Set([...(selectedOrders || []), ...ids]);
      setSelectedOrders(Array.from(merged));
    } else {
      setSelectedOrders((selectedOrders || []).filter(id => !ids.includes(id)));
    }
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
        await callCancelAPI(order?.id);
        await fetchOrders();
        setIsDetailModalOpen(false);
        setSelectedOrder(null);
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
          await Promise.allSettled((orderIds || []).map((id) => callCancelAPI(id)));
          setSelectedOrders([]);
          await fetchOrders();
        } catch (error) {
          console.error('Error bulk cancelling orders:', error?.message);
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

  const handleFiltersChange = (nextFilters) => {
    setFilters(nextFilters);
    setCurrentPage(0);
  };

  const totalInTab = (orders ?? []).filter(o => {
    if (activeTab === 'scheduled') return SCHEDULED_STATUSES.includes(o.status);
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-heading font-bold text-foreground">
                  Order History & Management
                </h1>
                <p className="text-muted-foreground">
                  Track, manage, and analyze your team's meal orders
                </p>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 gap-3 sm:gap-0 w-full sm:w-auto">
                <Button
                  onClick={() => navigate('/calendar-order-scheduling')}
                  iconName="Plus"
                  iconPosition="left"
                  className="w-full sm:w-auto"
                >
                  New Order
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-border">
              <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
                <nav className="-mb-px flex gap-4 sm:gap-8 whitespace-nowrap">
                  {tabs?.map((tab) => (
                    <button
                      key={tab?.id}
                      onClick={() => handleTabChange(tab?.id)}
                      className={`
                        flex items-center gap-2 py-3 sm:py-4 px-1 border-b-2 font-medium text-sm transition-athletic
                        ${activeTab === tab?.id
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
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
          </div>

          {/* Filters */}
          <OrderFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
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
            orders={paginatedOrders}
            selectedOrders={selectedOrders}
            onOrderSelect={handleOrderSelect}
            onSelectAll={(checked) => handleSelectAll(checked, paginatedOrders)}
            onOrderAction={handleOrderAction}
            activeTab={activeTab}
            onRefresh={fetchOrders}
          />

          {/* Pagination */}
          {filteredOrders?.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                variant="outline"
                size="sm"
                iconName="ChevronLeft"
                onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                disabled={!canGoPrev}
              >
                Previous
              </Button>
              <div className="text-sm text-muted-foreground">
                Showing {filteredOrders.length === 0 ? 0 : `${pageStart}-${pageEnd}`} of {filteredOrders.length} orders
              </div>
              <Button
                variant="outline"
                size="sm"
                iconName="ChevronRight"
                onClick={() => setCurrentPage((prev) => (canGoNext ? prev + 1 : prev))}
                disabled={!canGoNext}
              >
                Next
              </Button>
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
