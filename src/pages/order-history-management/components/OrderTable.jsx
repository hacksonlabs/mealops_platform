import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';
import PeopleTooltip from '../../../components/ui/PeopleTooltip';
import { getMealTypeIcon, getStatusBadge, formatDate, formatCurrency } from '../../../utils/ordersUtils';
import { callCancelAPI } from '../../../utils/ordersApiUtils';

const OrderTable = ({
  orders,
  selectedOrders,
  onOrderSelect,
  onSelectAll,
  onOrderAction,
  activeTab,
  onRefresh,
}) => {
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const openCancelConfirm = (order) => {
    setOrderToCancel(order);
    setCancelError(null);
    setConfirmOpen(true);
  };
  const closeConfirm = () => {
    setConfirmOpen(false);
    setOrderToCancel(null);
    setCancelError(null);
  };

  const confirmCancel = async () => {
    if (!orderToCancel || isCancelling) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await callCancelAPI(orderToCancel.id, '');
      if (typeof onRefresh === 'function') {
        await onRefresh();
      } else {
        window.dispatchEvent(new CustomEvent('orders:refresh'));
      }
      closeConfirm();
    } catch (err) {
  const status = err?.status;
    let msg = err?.message || 'Failed to cancel the order.';
    if (status === 0) msg = 'Cannot reach the API server. Check that it is running and the proxy is set.';
    else if (status === 404) msg = 'Order not found.';
    else if (status === 409) msg = 'Order is already cancelled.';
    else if (status === 422) msg = 'Cancellation window has passed for this order.';
    else if (status >= 500) msg = `Server error (${status}). Check backend logs.`;
    setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  // Close modal on Esc
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') closeConfirm(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmOpen]);

  const sortedOrders = useMemo(() => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    const arr = [...(orders ?? [])];
    arr.sort((a, b) => {
      switch (sortField) {
        case 'date':       return (new Date(a.date) - new Date(b.date)) * dir;
        case 'restaurant': return (a.restaurant || '').localeCompare(b.restaurant || '') * dir;
        case 'attendees':  return ((a.attendees || 0) - (b.attendees || 0)) * dir;
        case 'totalCost':  return ((a.totalCost || 0) - (b.totalCost || 0)) * dir;
        default:           return 0;
      }
    });
    return arr;
  }, [orders, sortField, sortDirection]);

  const handleSort = (field) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const getSortIcon = (field) =>
    sortField !== field ? 'ArrowUpDown' : sortDirection === 'asc' ? 'ArrowUp' : 'ArrowDown';

  const getActionButtons = (order) => {
    if (activeTab === 'scheduled') {
      return (
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={() => onOrderAction('view', order)} iconName="Eye" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openCancelConfirm(order)}
            iconName="X"
            title="Cancel Record"
            className="text-red-600 hover:text-red-700"
          />
        </div>
      );
    } else if (activeTab === 'completed' || activeTab === 'all') {
      return (
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={() => onOrderAction('view', order)} iconName="Eye" />
          <Button variant="ghost" size="sm" onClick={() => onOrderAction('receipt', order)} iconName="Download" />
        </div>
      );
    }
    return (
      <div className="flex items-center space-x-1">
        <Button variant="ghost" size="sm" onClick={() => onOrderAction('view', order)} iconName="Eye" />
      </div>
    );
  };

  const isAllSelected = orders?.length > 0 && selectedOrders?.length === orders?.length;
  const isIndeterminate = selectedOrders?.length > 0 && selectedOrders?.length < orders?.length;

  // ---- Hover tooltip state (portal, upward) ----
  const [hoverOrderId, setHoverOrderId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const anchorRefs = useRef(new Map());
  const closeTimerRef = useRef(null);

  const setAnchorRef = useCallback((id) => (node) => {
    const map = anchorRefs.current;
    if (node) map.set(id, node);
    else map.delete(id);
  }, []);

  const positionTooltip = useCallback((orderId) => {
    const el = anchorRefs.current.get(orderId);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  useEffect(() => {
    if (!hoverOrderId) return;
    const handle = () => positionTooltip(hoverOrderId);
    window.addEventListener('scroll', handle, true);
    window.addEventListener('resize', handle);
    return () => {
      window.removeEventListener('scroll', handle, true);
      window.removeEventListener('resize', handle);
    };
  }, [hoverOrderId, positionTooltip]);

  const openOnHover = (orderId) => {
    if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; }
    positionTooltip(orderId);
    setHoverOrderId(orderId);
  };
  const scheduleClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setHoverOrderId(null), 120);
  };
  const cancelClose = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={(e) => onSelectAll(e?.target?.checked)}
                />
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('date')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Date & Time</span>
                  <Icon name={getSortIcon('date')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('restaurant')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Restaurant</span>
                  <Icon name={getSortIcon('restaurant')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Meal Type</span>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('attendees')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Attendees</span>
                  <Icon name={getSortIcon('attendees')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button
                  onClick={() => handleSort('totalCost')}
                  className="flex items-center space-x-1 text-sm font-medium text-foreground hover:text-primary transition-athletic"
                >
                  <span>Total Cost</span>
                  <Icon name={getSortIcon('totalCost')} size={14} />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="text-sm font-medium text-foreground">Status</span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="text-sm font-medium text-foreground">Actions</span>
              </th>
            </tr>
          </thead>

            <tbody className="divide-y divide-border">
              {sortedOrders?.map((order) => (
                <tr key={order?.id} className="hover:bg-muted/50 transition-athletic">
                  <td className="px-4 py-4">
                    <Checkbox
                      checked={selectedOrders?.includes(order?.id)}
                      onChange={(e) => onOrderSelect(order?.id, e?.target?.checked)}
                    />
                  </td>

                  <td className="px-4 py-4">
                    <div className="text-sm text-foreground font-medium">{formatDate(order?.date)}</div>
                    <div className="text-xs text-muted-foreground">{order?.location}</div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <Icon name="Store" size={16} className="text-muted-foreground" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{order?.restaurant}</div>
                        <div className="text-xs text-muted-foreground">Order #{order?.orderNumber}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <Icon name={getMealTypeIcon(order?.mealType)} size={16} className="text-muted-foreground" />
                      <span className="text-sm text-foreground capitalize">{order?.mealType}</span>
                    </div>
                  </td>

                  {/* Attendees — hover tooltip (portal, upward) */}
                  <td className="px-4 py-4">
                    <div
                      className="relative inline-block"
                      ref={setAnchorRef(order.id)}
                      onMouseEnter={() => openOnHover(order.id)}
                      onMouseLeave={scheduleClose}
                      title={(order?.teamMembers || []).join(', ')}
                    >
                      <div className="text-sm text-primary font-medium underline underline-offset-2 cursor-default flex items-center gap-1">
                        <Icon name="Users" size={16} className="text-primary" />
                        {order?.attendees} {order?.attendees === 1 ? 'person' : 'people'}
                      </div>

                      <PeopleTooltip
                        open={hoverOrderId === order.id}
                        x={tooltipPos.x}
                        y={tooltipPos.y}
                        names={order.teamMembers || []}
                        onMouseEnter={cancelClose}
                        onMouseLeave={scheduleClose}
                      />
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-foreground">{formatCurrency(order?.totalCost)}</div>
                  </td>

                  <td className="px-4 py-4">{getStatusBadge(order?.status)}</td>

                  <td className="px-4 py-4 text-right">{getActionButtons(order)}</td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      {orders?.length === 0 && (
        <div className="text-center py-12">
          <Icon name="ClipboardList" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No orders found</h3>
          <p className="text-muted-foreground">Try adjusting your filters or create a new order to get started.</p>
        </div>
      )}

      {/* CONFIRMATION POPUP */}
      {confirmOpen && createPortal(
        <div className="fixed inset-0 z-[100]">
          <div className="absolute inset-0 bg-black/40" onClick={closeConfirm} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden">
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <Icon name="AlertTriangle" size={20} className="text-red-600" />
                  <h3 className="text-lg font-semibold text-foreground">Cancel scheduled meal?</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  This will mark the order as <span className="text-foreground font-medium">cancelled</span> in MealOps.
                </p>
                {orderToCancel && (
                  <div className="mt-3 text-sm">
                    <div className="text-foreground font-medium">{orderToCancel.restaurant}</div>
                    <div className="text-muted-foreground">{formatDate(orderToCancel.date)}</div>
                  </div>
                )}

                {cancelError && (
                  <div className="mt-3 rounded-md border border-red-300 bg-red-50 text-red-700 text-sm px-3 py-2">
                    {cancelError}
                  </div>
                )}
              </div>

              <div className="px-5 pb-5 flex justify-end gap-2">
                <Button variant="outline" onClick={closeConfirm} disabled={isCancelling}>Never mind</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={confirmCancel}
                  iconName="X"
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling…' : 'Cancel meal'}
                </Button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default OrderTable;