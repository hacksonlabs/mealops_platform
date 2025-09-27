// src/pages/shopping-cart-checkout/index.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import RestaurantHeader from './components/RestaurantHeader';
import OrderSummary from './components/OrderSummary';
import DeliveryInformation from './components/DeliveryInformation';
import PaymentSection from './components/PaymentSection';
import AccountDetailsSection from './components/AccountDetailsSection';
import TeamAssignments from './components/TeamAssignments';
import OrderItemsModal from './components/OrderItemsModal';
import { useAuth } from '../../contexts/AuthContext';
// import sharedCartService from '../../services/sharedCartService'; // (unused)
import cartDbService from '../../services/cartDBService';
import { paymentService, PROVIDER_CONFIG } from '../../services/paymentService';
import { useSharedCart } from "../../contexts/SharedCartContext";
import { orderService } from '../../services/orderService';
import { orderDbService } from '../../services/orderDbService';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { expandItemsToUnitRows, sortAssigneeRows } from '../../utils/cartDisplayUtils';
import { featureFlags, mealMeConfig } from '../../config/runtimeConfig';

/** Toggle this to bypass real provider calls while designing the flow */
const PAYMENTS_MOCK = featureFlags.paymentsMock;

const MEALME_ENABLED = featureFlags.mealMeEnabled;
const ACTIVE_PAYMENTS_PROVIDER = MEALME_ENABLED ? 'mealme' : 'stripe';
const ORDER_SANDBOX = PAYMENTS_MOCK || mealMeConfig.environment !== 'production';

const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const ShoppingCartCheckout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const setServiceParam = (svc) => {
    const qs = new URLSearchParams(location.search);
    if (svc) qs.set('service', svc);
    else qs.delete('service');
    navigate({ search: qs.toString() }, { replace: true });
  };

  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    activeCartId,
    setActiveCartId,
    // getActiveSharedCart, // (unused here)
    logCartActivity
  } = useSharedCart();

  const urlCartId = searchParams?.get('cartId');
  const currentCartId = urlCartId || activeCartId;

  const now = useMemo(() => new Date(), []);
  const inStateFulfillment = location.state?.fulfillment;
  const [fulfillment, setFulfillment] = useState({
    service: inStateFulfillment?.service ?? 'delivery',
    address: inStateFulfillment?.address ?? '123 Main Street, Apt 4B, New York, NY 10001',
    coords: inStateFulfillment?.coords ?? null,
    date: inStateFulfillment?.date ?? toDateInput(now),
    time: inStateFulfillment?.time ?? toTimeInput(now),
    instructions: inStateFulfillment?.instructions ?? '',
  }); 

  const [restaurant] = useState(
    location.state?.restaurant || {
      id: 1,
      name: "Tony's Authentic Pizzeria",
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
      rating: 4.8,
      distance: '0.8 miles',
      address: '',
    }
  );

  const [cartItems, setCartItems] = useState([]);
  const [sharedCartData, setSharedCartData] = useState(null);
  const [isSharedCart, setIsSharedCart] = useState(false);
  const [loading, setLoading] = useState(false);

  const [serviceType, setServiceType] = useState(() => inStateFulfillment?.service ?? 'delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(() => inStateFulfillment?.address ?? '');
  const [pickupTime, setPickupTime] = useState('asap');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [estimatedTime, setEstimatedTime] = useState('30-40 min');

  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  // Split preview/config
  const [splitEnabled, setSplitEnabled] = useState(true);
  const [splitThresholdCents, setSplitThresholdCents] = useState(25000);
  const [splitPreview, setSplitPreview] = useState(null); // [{ split_index, total_cents, entries:[{assignee,item,price}]}]
  const [showSplitPreview, setShowSplitPreview] = useState(false);
  const [selectedSplitPart, setSelectedSplitPart] = useState(null); // { split_index, entries }
  const [showSplitItemsModal, setShowSplitItemsModal] = useState(false);

  const lineQty = (it) => {
    const raw = Number(it?.quantity);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  };
  
  const orderItemsCount = useMemo(
    () => (cartItems || []).reduce((n, it) => n + lineQty(it), 0),
    [cartItems]
  );

  // Account details
  const [account, setAccount] = useState({
    contactName: user?.user_metadata?.full_name || user?.full_name || '',
    email: user?.email || '',
    phone: '',
  });

  // items modal
  const [showItemsModal, setShowItemsModal] = useState(false);

  const mapMethods = (rows = []) => rows.map((m) => ({
    id: m.id,
    type: 'card',
    brand: m.brand,
    last4: m.last_four,
    expiry: m.exp_month && m.exp_year ? `${String(m.exp_month).padStart(2,'0')}/${String(m.exp_year).slice(-2)}` : '',
    isDefault: !!m.is_default,
    cardName: m.card_name,
  }));

  const handleFulfillmentChange = (next) => {
    setFulfillment(next);
    setServiceType(next.service);
    setServiceParam(next.service);
    setDeliveryAddress(next.address || '');
    setEstimatedTime(next.service === 'delivery' ? '30-40 min' : '20-25 min');
    if (next.service === 'pickup') setTipAmount(0);
  };

  const handleServiceTypeChange = (type) => {
    setServiceType(type);
    setServiceParam(type);
    setEstimatedTime(type === 'delivery' ? '30-40 min' : '20-25 min');
    if (type === 'pickup') setTipAmount(0);
    setFulfillment((prev) => (prev.service === type ? prev : { ...prev, service: type }));
  };

  useEffect(() => {
    if (currentCartId && user?.id) {
      loadCartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCartId, user?.id]);

  useEffect(() => {
    const handleCartItemsChange = (event) => {
      const { detail } = event;
      if (detail?.cartId === currentCartId) loadCartData();
    };
    window.addEventListener('cartItemsChanged', handleCartItemsChange);
    return () => window.removeEventListener('cartItemsChanged', handleCartItemsChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCartId]);

  const loadCartData = async () => {
    try {
      setLoading(true);
      const cartSnapshot = await cartDbService.getCartSnapshot(currentCartId);
      if (!cartSnapshot) return;

      const f = {
        service: cartSnapshot?.cart?.fulfillment_service ?? 'delivery',
        address: cartSnapshot?.cart?.fulfillment_address ?? '',
        coords:
          cartSnapshot?.cart?.fulfillment_latitude != null &&
          cartSnapshot?.cart?.fulfillment_longitude != null
            ? { lat: cartSnapshot.cart.fulfillment_latitude, lng: cartSnapshot.cart.fulfillment_longitude }
            : null,
        date: cartSnapshot?.cart?.fulfillment_date ?? null,
        time: cartSnapshot?.cart?.fulfillment_time ?? null,
      };
      setFulfillment(f);
      setServiceType(f.service);
      setDeliveryAddress(f.address);

      setSharedCartData(cartSnapshot);
      setIsSharedCart(true);

      const items = (cartSnapshot.items || []).map((it) => {
        if (Array.isArray(it?.assignedTo) && it.assignedTo.length) return it;
        if (it?.isExtra || it?.is_extra) {
          const count = Math.max(1, Number(it?.quantity || 1));
          return { ...it, assignedTo: Array.from({ length: count }, () => ({ name: 'Extra', isExtra: true })) };
        }
        if (it?.memberId || it?.member_id) {
          const name =
            it?.assignedTo?.[0]?.name
            || it?.memberName
            || it?.userName
            || 'Team member';
          return { ...it, assignedTo: [{ id: it.memberId || it.member_id, name }] };
        }
        const a = it?.selectedOptions?.__assignment__ || it?.selected_options?.__assignment__;
        if (a?.display_names?.length) {
          return { ...it, assignedTo: a.display_names.map((n) => ({ name: n })) };
        }
        return it;
      });
      setCartItems(items);
      broadcastHeader(cartSnapshot);

      setAccount((prev) => ({ ...prev, teamName: prev.teamName || cartSnapshot?.cart?.teamName || '' }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onRemove = (e) => {
      const { itemId } = e?.detail || {};
      if (!itemId) return;
      handleRemoveItem(itemId);
    };
    window.addEventListener('cartItemRemove', onRemove);
    return () => window.removeEventListener('cartItemRemove', onRemove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCartId, isSharedCart]); 

  const broadcastHeader = (snap) => {
    const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
    const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
    window.dispatchEvent(new CustomEvent('cartBadge', {
      detail: {
        count, total,
        name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
        cartId: snap.cart.id,
        restaurant: snap.restaurant,
        items: snap.items,
        ownerMemberId: snap.cart?.createdByMemberId ?? null,
      },
    }));
  };

  const subtotal = cartItems?.reduce((sum, item) => {
    const itemTotal = (item?.price || 0) * (item?.quantity || 0);
    const customizationTotal =
      item?.customizations?.reduce(
        (customSum, custom) => customSum + (custom?.price || 0) * (item?.quantity || 0),
        0
      ) || 0;
    return sum + itemTotal + customizationTotal;
  }, 0);

  const deliveryFee = serviceType === 'delivery' ? 2.99 : 0;
  const tax = subtotal * 0.08;
  const total = subtotal + deliveryFee + tax + tipAmount - promoDiscount;

  /** In mock mode, never block the button on card selection */
  const requiresCardSelection =
    !PAYMENTS_MOCK && (
      ACTIVE_PAYMENTS_PROVIDER === 'stripe' ||
      (ACTIVE_PAYMENTS_PROVIDER === 'mealme' && savedPaymentMethods.length > 0)
    );

  const isFormValid = () =>
    cartItems?.length > 0 &&
    (!requiresCardSelection || selectedPaymentMethod) &&
    (serviceType === 'pickup' || (deliveryAddress || '').trim()) &&
    (account?.contactName || '').trim() &&
    (account?.email || '').trim();

  const handleQuantityChange = async (itemId, newQuantity) => {
    if (!currentCartId) return;
    await cartDbService.updateItem(currentCartId, itemId, { quantity: Math.max(0, newQuantity) });
    await loadCartData();
  };

  const handleRemoveItem = async (itemId) => {
    if (!currentCartId) return;
    await cartDbService.removeItem(currentCartId, itemId);
    await loadCartData();
  };

  const handleEditItem = (item) => {
    const rid = sharedCartData?.restaurant?.id || restaurant?.id;
    navigate(`/restaurant/${rid}`, {
      state: {
        editItem: item,
        restaurantId: rid,
        cartId: currentCartId,
      },
    });
  };

  const handlePromoCodeApply = (code) => {
    const discounts = {
      SAVE10: subtotal * 0.1,
      WELCOME20: 5.0,
      FREESHIP: deliveryFee,
    };
    setPromoCode(code || '');
    setPromoDiscount(discounts?.[code] || 0);
  };

  const cents = (d) => Math.round(Number(d || 0) * 100);

  // Load split config (flag + threshold)
  useEffect(() => {
    (async () => {
      try {
        const cfg = await orderDbService.getSplitConfig();
        setSplitEnabled(!!cfg.enabled);
        setSplitThresholdCents(cfg.thresholdCents || 25000);
      } catch {}
    })();
  }, []);

  const canSplitByThreshold = useMemo(() => {
    return splitEnabled && cents(total) > (splitThresholdCents || 25000);
  }, [splitEnabled, total, splitThresholdCents]);

  // FE helper preview (fallback if we don't persist a temp draft)
  const previewSplitClient = () => {
    // Use shared utils to expand to per-unit rows and sort by assignment order
    const expanded = expandItemsToUnitRows(cartItems || []);
    const collator = new Intl.Collator('en', { sensitivity: 'base' });
    const sorted = sortAssigneeRows(expanded, collator);

    const units = sorted.map((r) => ({
      assignee: r.assignee || '',
      item: r.itemName,
      price: Number(
        r.unitPrice ?? r.price ?? r.basePrice ?? r.unit ?? r.unit_price ?? 0
      ),
      // derive kind via assignee naming
      kind: !r.assignee ? 'unassigned' : (/^extra$/i.test(r.assignee) ? 'extra' : 'assigned')
    }));

    // Re-sort to ensure extras last, unassigned after assigned (if not already)
    units.sort((a, b) => {
      const rank = (k) => (k === 'assigned' ? 0 : k === 'unassigned' ? 1 : 2);
      const ra = rank(a.kind);
      const rb = rank(b.kind);
      if (ra !== rb) return ra - rb;
      return collator.compare(a.assignee || '', b.assignee || '');
    });

    const max = splitThresholdCents || 25000;
    const buckets = [];
    let current = { idx: 1, totalCents: 0, entries: [] };
    units.forEach((u) => {
      const cents = Math.round(Number(u.price || 0) * 100);
      if (current.totalCents + cents > max && current.entries.length > 0) {
        buckets.push(current);
        current = { idx: current.idx + 1, totalCents: 0, entries: [] };
      }
      current.totalCents += cents;
      current.entries.push({ assignee: u.assignee || '—', item: u.item, price: Number(u.price || 0) });
    });
    if (current.entries.length > 0) buckets.push(current);

    setSplitPreview(buckets.map((b) => ({ split_index: b.idx, total_cents: b.totalCents, entries: b.entries })));
    setShowSplitPreview(true);
  };

  const handlePlaceOrder = async () => {
    // compute cents we want to persist
    const subtotalCents = cents(subtotal);
    const deliveryFeeCents = cents(deliveryFee);
    const taxCents = cents(tax);
    const tipCents = cents(tipAmount);
    const promoDiscountCents = cents(promoDiscount);
    // If you have a separate service fee, compute it; otherwise leave 0/null
    const computedTotalCents = cents(total);
    const serviceFeeCents = Math.max(
      0,
      computedTotalCents - (subtotalCents + deliveryFeeCents + taxCents + tipCents - promoDiscountCents)
    );

    // Build the MealMe-shaped payload (we already have this helper)
    const orderInput = buildMealMePayloadFromCart();

    // Snapshot of the selected payment method for analytics/reporting (optional)
    const paymentSnap = savedPaymentMethods.find(m => m.id === selectedPaymentMethod) || null;

    // 1) Create local draft (safe status + all info persisted)
    const { localOrderId } = await orderDbService.createDraftFromCart({
      cartSnapshot: sharedCartData,
      orderInput,
      quote: {
        subtotal_cents: subtotalCents,
        fees_cents: deliveryFeeCents,
        service_fee_cents: serviceFeeCents || null,
        tax_cents: taxCents,
        tip_cents: tipCents,
        total_with_tip_cents: computedTotalCents,
      },
      provider: MEALME_ENABLED ? 'mealme' : 'manual',
      isSandbox: ORDER_SANDBOX,
      createdBy: user?.id,
      paymentMethodId: selectedPaymentMethod || null,
      deliveryInstructions: fulfillment?.instructions || '',
      account: { name: account.contactName, email: account.email, phone: account.phone },
      paymentSnapshot: paymentSnap,
      promoCode: promoCode || null,
      promoDiscountCents,
    });

    // Optionally apply server-side split before proceeding (tests the RPC)
    if (canSplitByThreshold) {
      try {
        await orderDbService.applySplit(localOrderId, splitThresholdCents);
      } catch (e) {
        console.warn('Split apply error:', e?.message || e);
      }
    }

    // 2) In MOCK: jump to confirmed & success
    if (PAYMENTS_MOCK) {
      await orderDbService.markScheduled(localOrderId, {
        response_payload: { mock: true },
      });
      // (Optional) log activity
      if (isSharedCart && currentCartId) {
        try {
          await logCartActivity?.(currentCartId, 'order_placed', {
            total_amount_cents: computedTotalCents,
            item_count: cartItems?.length,
            mock: true,
            promo_code: promoCode || null,
          });
        } catch (e) {
          console.error('Mock order log error:', e);
        }
      }
      navigate('/order/success', { replace: true, state: { mock: true, orderId: localOrderId } });
      return;
    }

    // 3) REAL STRIPE path (unchanged)
    if (ACTIVE_PAYMENTS_PROVIDER === 'stripe') {
      await orderDbService.markPendingConfirmation(localOrderId); // we’re heading to payment
      const { kind, url } = await paymentService.startCheckout({
        lineItems: buildStripeLineItems(cartItems),
        metadata: { cartId: currentCartId, localOrderId },
        successUrl: `${window.location.origin}/order/success`,
        cancelUrl: `${window.location.origin}${location.pathname}${location.search}`,
      }, { provider: 'stripe', customerId: user?.stripe_customer_id });
      if (kind === 'redirect') window.location.href = url;
      return;
    }

    // 4) REAL MEALME path: create provider draft, then go to pay page
    await orderDbService.markPendingConfirmation(localOrderId);
    const { orderId: providerOrderId } = await orderService.createDraft(orderInput);

    // keep provider id on our order
    await orderDbService.attachProviderInfo(localOrderId, {
      api_order_id: providerOrderId,
    });

    // In real mode, get client secret from backend, then open /pay
    const result = await paymentService.startCheckout(
      { mealmePayload: { ...orderInput, order_id: providerOrderId } },
      { provider: 'mealme' }
    );

    navigate('/pay', {
      state: {
        clientSecret: result.clientSecret,
        publishableKey: result.publishableKey,
        orderId: providerOrderId,
        localOrderId,
        mode: 'payment',
      },
    });
  };


  useEffect(() => {
    setEstimatedTime(serviceType === 'delivery' ? '30-40 min' : '20-25 min');
  }, [serviceType]);

  useEffect(() => {
    if (urlCartId && urlCartId !== activeCartId) {
      setActiveCartId?.(urlCartId);
    }
  }, [urlCartId, activeCartId, setActiveCartId]);

  /** Load saved payment methods:
   *  - MOCK: read from your DB only
   *  - REAL: use provider-aware service (MealMe may hydrate + mirror to DB)
   */
  useEffect(() => {
    const teamId = sharedCartData?.cart?.teamId || null;
    if (!user?.id) return;

    (async () => {
      setLoadingPayments(true);
      try {
        let result;
        if (PAYMENTS_MOCK && ACTIVE_PAYMENTS_PROVIDER === 'mealme') {
          result = await paymentService.getTeamPaymentMethods(teamId);
        } else {
          result = await paymentService.getPaymentMethods(teamId, {
            provider: ACTIVE_PAYMENTS_PROVIDER,
            userId: user?.id,
            email: user?.email,
          });
        }
        const { data, error } = result || {};
        if (error) return;
        const methods = mapMethods(data);
        setSavedPaymentMethods(methods);
        setSelectedPaymentMethod((prev) =>
          prev || methods.find((m) => m.isDefault)?.id || methods[0]?.id || ''
        );
      } finally {
        setLoadingPayments(false);
      }
    })();
  }, [user?.id, sharedCartData?.cart?.teamId]);

  // If we come back from /pay with a new card, refresh & select one
  useEffect(() => {
    if (location.state?.refreshCards) {
      (async () => {
        setLoadingPayments(true);
        try {
          const teamId = sharedCartData?.cart?.teamId || null;
          let result;
          if (PAYMENTS_MOCK && ACTIVE_PAYMENTS_PROVIDER === 'mealme') {
            result = await paymentService.getTeamPaymentMethods(teamId);
          } else {
            result = await paymentService.getPaymentMethods(teamId, {
              provider: ACTIVE_PAYMENTS_PROVIDER,
              userId: user?.id,
              email: user?.email,
            });
          }
          const { data } = result || {};
          const methods = mapMethods(data || []);
          setSavedPaymentMethods(methods);
          setSelectedPaymentMethod(methods.find(m => m.isDefault)?.id || methods[0]?.id || '');
        } finally {
          setLoadingPayments(false);
          // clear the flag so we don't loop
          navigate(location.pathname + location.search, { replace: true, state: {} });
        }
      })();
    }
  }, [location.state?.refreshCards]);

  /** Add card:
   *  - MOCK + MealMe: insert a fake method into your DB so the UI updates
   *  - REAL: use provider flows
   */
  const handleAddCard = async () => {
    const teamId = sharedCartData?.cart?.teamId || null;

    // MOCK path (no provider calls)
    if (PAYMENTS_MOCK && ACTIVE_PAYMENTS_PROVIDER === 'mealme') {
      const mockRow = {
        team_id: teamId,
        card_name: 'Test Visa',
        last_four: '4242',
        is_default: savedPaymentMethods.length === 0, // first one becomes default
        provider: 'mealme',
        provider_customer_id: 'mock_cus_123',
        provider_payment_method_id: `mock_pm_${Date.now()}`,
        brand: 'visa',
        exp_month: 12,
        exp_year: 2030,
        billing_zip: '00000',
      };
      const { data } = await paymentService.createPaymentMethod(mockRow);
      // Refresh local list
      const { data: refreshed } = await paymentService.getTeamPaymentMethods(teamId);
      const methods = mapMethods(refreshed || []);
      setSavedPaymentMethods(methods);
      setSelectedPaymentMethod(data?.id || methods.find(m => m.isDefault)?.id || methods[0]?.id || '');
      return;
    }

    // REAL providers (when you flip PAYMENTS_MOCK off)
    if (ACTIVE_PAYMENTS_PROVIDER === 'stripe') {
      const { kind, url } = await paymentService.startSetup({
        provider: 'stripe',
        customerId: user?.stripe_customer_id,
        successUrl: `${window.location.origin}/shopping-cart-checkout?added=1`,
        cancelUrl: `${window.location.origin}${location.pathname}${location.search}`,
      });
      if (kind === 'redirect') window.location.href = url;
      return;
    }

    if (ACTIVE_PAYMENTS_PROVIDER === 'mealme') {
      // Your real MealMe "setup" flow would navigate to /pay with a clientSecret
      // When you connect MealMe, swap PAYMENTS_MOCK off and implement here.
      console.warn('MealMe add card flow is disabled in mock mode.');
    }
  };

  const handleManageCards = async () => {
    if (ACTIVE_PAYMENTS_PROVIDER !== 'stripe') return;
    const { kind, url } = await paymentService.openManagePortal({
      provider: 'stripe',
      customerId: user?.stripe_customer_id,
      returnUrl: window.location.href,
    });
    if (kind === 'redirect') window.location.href = url;
  };

  const buildStripeLineItems = (items) =>
    items.map(it => ({
      price: it.stripe_price_id,
      quantity: Number(it.quantity || 1),
    })).filter(Boolean);

  const buildMealMePayloadFromCart = () => ({
    items: (cartItems || []).map(it => ({
      product_id: it.product_id || it.id,
      quantity: Number(it.quantity || 1),
      notes: it.notes || undefined,
      selected_options: [],
      price_cents: Math.round((it.price || 0) * 100), 
    })),
    pickup: serviceType === 'pickup',
    driver_tip_cents: serviceType === 'delivery' ? Math.round(Number(tipAmount || 0) * 100) : 0,
    pickup_tip_cents: serviceType === 'pickup' ? Math.round(Number(tipAmount || 0) * 100) : 0,
    user_latitude: fulfillment?.coords?.lat,
    user_longitude: fulfillment?.coords?.lng,
    user_street_num: '',                // split from address parser later
    user_street_name: deliveryAddress,  // split from address parser later
    user_city: '',                      // split from address parser later
    user_state: '',                     // split from address parser later
    user_country: 'US',
    user_zipcode: '',
    user_name: account?.contactName,
    user_email: account?.email,
    user_phone: account?.phone,
    user_id: user?.id,
    include_final_quote: true,
  });

  const provider = sharedCartData?.cart?.providerType || 'grubhub';
  const paymentMode = MEALME_ENABLED
    ? 'self_hosted' // ignore provider when flag is on
    : (PROVIDER_CONFIG[provider]?.paymentMode || 'external_redirect');
  const pickupAddress = sharedCartData?.restaurant?.address || location.state?.restaurant?.address || restaurant?.address || '';
  const pickupName = sharedCartData?.restaurant?.name || location.state?.restaurant?.name || restaurant?.name || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16">
          <div className="max-w-4xl mx-auto px-4 lg:px-6 py-10">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mr-3" />
              <span className="text-muted-foreground">Loading cart...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- Right sidebar block (summary + tip + button in one container) ---
  const SidebarCheckout = () => (
    <div className="sticky top-32">
      <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
        <OrderSummary
          subtotal={subtotal}
          deliveryFee={deliveryFee}
          tax={tax}
          discount={promoDiscount}
          total={total}
          serviceType={serviceType}
          onPromoCodeApply={handlePromoCodeApply}
          tipAmount={tipAmount}
          onTipChange={setTipAmount}
        />

        <Button
          className="w-full h-12 items-center justify-center gap-2 whitespace-nowrap text-base font-semibold mt-6"
          onClick={handlePlaceOrder}
          disabled={!isFormValid()}
          iconName={serviceType === 'delivery' ? 'Truck' : 'ShoppingBag'}
          iconPosition="left"
        >
          Place {serviceType === 'delivery' ? 'Delivery' : 'Pickup'} Order
        </Button>

        {!isFormValid() && (
          <p className="text-xs text-error mt-2">
            Complete required fields before placing your order.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-32 md:pb-8">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          {/* Back */}
          <div className="mt-4 mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Icon name="ArrowLeft" size={16} className="mr-2" />
              Back to Menu
            </Button>
          </div>

          <div className="space-y-6">
            {/* Restaurant Header */}
            <RestaurantHeader
              restaurant={sharedCartData?.restaurant || restaurant}
              serviceType={serviceType}
              onServiceTypeChange={handleServiceTypeChange}
              estimatedTime={estimatedTime}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT (wider) */}
              <div className="lg:col-span-7 space-y-6">
                {/* NEW: Account details */}
                <AccountDetailsSection account={account} onChange={setAccount} />
                {/* NEW: Team assignments */}
                <TeamAssignments items={cartItems} />
                {canSplitByThreshold && (
                  <div className="bg-amber-50/50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
                    <div className="text-sm text-amber-800">
                      This order exceeds the provider maximum and will be split when placed.
                    </div>
                    <Button size="sm" variant="outline" onClick={previewSplitClient}>
                      <Icon name="SplitSquareHorizontal" size={14} className="mr-1" />
                      Preview Split
                    </Button>
                  </div>
                )}
                {/* Order summary header (count + modal trigger only) */}
                <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name="ShoppingCart" size={18} className="text-primary" />
                      <h2 className="text-lg font-semibold text-foreground">Your Order</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {orderItemsCount} {orderItemsCount === 1 ? 'item' : 'items'}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setShowItemsModal(true)}>
                        <Icon name="List" size={14} className="mr-1" />
                        View details
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Delivery / Pickup */}
                <DeliveryInformation
                  cartId={currentCartId}
                  fulfillment={fulfillment}
                  onFulfillmentChange={(next) => setFulfillment(next)}
                  serviceType={serviceType}
                  deliveryAddress={deliveryAddress}
                  onAddressChange={(addr) => {
                    setDeliveryAddress(addr);
                    setFulfillment((prev) => ({ ...prev, address: addr }));
                  }}
                  onAddressResolved={(details) => {
                    if (details?.location) {
                      setFulfillment((prev) => ({ ...prev, coords: details.location }));
                    }
                  }}
                  instructions={fulfillment.instructions}
                  onInstructionsChange={(val) =>
                    setFulfillment(prev => ({ ...prev, instructions: val }))
                  }
                  pickupTime={pickupTime}
                  onPickupTimeChange={setPickupTime}
                  pickupAddress={pickupAddress}
                  pickupName={pickupName}
                />

                {/* Payment */}
                {paymentMode === 'self_hosted' ? (
                  <PaymentSection
                    provider={ACTIVE_PAYMENTS_PROVIDER}
                    selectedPaymentMethod={selectedPaymentMethod}
                    onPaymentMethodChange={setSelectedPaymentMethod}
                    savedPaymentMethods={savedPaymentMethods}
                    loadingPayments={loadingPayments}
                    onAddCard={handleAddCard}
                    onManageCards={handleManageCards}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                    <h2 className="text-lg font-semibold">Payment</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Payment is handled securely by {provider ?? 'Stripe'}.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={async () => {
                        // External provider stub (not used while MEALME_ENABLED)
                        alert('External checkout would start here (mock).');
                      }}
                    >
                      Continue to {provider ?? 'Checkout'}
                    </Button>
                  </div>
                )}

              </div>

              {/* RIGHT (summary + tip + button) */}
              <div className="lg:col-span-5">
                <SidebarCheckout />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Items modal */}
      <OrderItemsModal
        open={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        items={cartItems}
      />

      {/* Split preview modal */}
      {showSplitPreview && (
        <div className="fixed inset-0 z-[1200] bg-black/40 p-4 flex items-center justify-center" onClick={() => setShowSplitPreview(false)}>
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-athletic-lg p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="SplitSquareHorizontal" size={18} />
                <h3 className="text-lg font-semibold">Split Preview</h3>
                <InfoTooltip text="Taxes + fees are applied per suborder. Individual receipts will be available." />
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowSplitPreview(false)}>
                <Icon name="X" size={18} />
              </Button>
            </div>
            {Array.isArray(splitPreview) && splitPreview.length ? (
              <div className="space-y-2">
                {splitPreview.map((p) => (
                  <button
                    key={p.split_index}
                    className="w-full flex items-center justify-between p-2 rounded bg-muted hover:bg-muted/70 text-left group"
                    onClick={() => { setSelectedSplitPart(p); setShowSplitItemsModal(true); }}
                  >
                    <div className="text-sm font-medium text-primary underline underline-offset-2 decoration-2 group-hover:decoration-primary">
                      Order {p.split_index}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground tabular-nums">{Array.isArray(p.entries) ? p.entries.length : 0} {p.entries?.length === 1 ? 'item' : 'items'}</span>
                      <div className="text-sm font-semibold tabular-nums">${(Number(p.total_cents || 0)/100).toFixed(2)}</div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No split necessary.</div>
            )}
          </div>
        </div>
      )}

      {/* Split part items modal */}
      {showSplitItemsModal && selectedSplitPart && (
        <div className="fixed inset-0 z-[1210] bg-black/40 p-4 flex items-center justify-center" onClick={() => setShowSplitItemsModal(false)}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-athletic-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="List" size={18} />
                <h3 className="text-lg font-semibold">Order {selectedSplitPart.split_index} Items</h3>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowSplitItemsModal(false)}>
                <Icon name="X" size={18} />
              </Button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-auto">
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-[13px] md:text-sm border-collapse">
                  <thead className="bg-card">
                    <tr className="border-b border-border">
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide w-10">#</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">Assignee</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">Item</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground uppercase text-[11px] tracking-wide">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSplitPart.entries.map((e, idx) => (
                      <tr key={idx} className={`border-b border-border ${idx % 2 ? 'bg-muted/20' : ''}`}>
                        <td className="py-2.5 px-3 text-right text-muted-foreground tabular-nums">{idx + 1}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-foreground">{e.assignee || '—'}</td>
                        <td className="py-2.5 px-3 text-foreground">{e.item}</td>
                        <td className="py-2.5 px-3 text-right tabular-nums text-foreground">${Number(e.price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShoppingCartCheckout;
