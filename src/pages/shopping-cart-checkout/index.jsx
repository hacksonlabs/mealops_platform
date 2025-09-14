import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import FulfillmentBar from '../../components/ui/FulfillmentBar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import RestaurantHeader from './components/RestaurantHeader';
import CartItemCard from './components/CartItemCard';
import OrderSummary from './components/OrderSummary';
import DeliveryInformation from './components/DeliveryInformation';
import PaymentSection from './components/PaymentSection';
import TipSelection from './components/TipSelection';
import CheckoutButton from './components/CheckoutButton';
import ShareCartButton from './components/ShareCartButton';
import SharedCartBanner from '../../components/ui/cart/SharedCartBanner';
import { useSharedCart } from '../../contexts/SharedCartContext';
import { useAuth } from '../../contexts/AuthContext';
import sharedCartService from '../../services/sharedCartService';
import cartDbService from '../../services/cartDBService';
import { paymentService } from '../../services/paymentService';
import providerService from '../../services/providerService';
import { PROVIDER_CONFIG } from '../../services/paymentService';

// Small helpers for default date/time
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
    getActiveSharedCart,
    logCartActivity
  } = useSharedCart();

  // Get cart ID from URL params or shared cart context
  const urlCartId = searchParams?.get('cartId');
  const currentCartId = urlCartId || activeCartId;

  // ---- Fulfillment (replaces PrimaryTab) ----
  const now = useMemo(() => new Date(), []);
  const inStateFulfillment = location.state?.fulfillment
  const [fulfillment, setFulfillment] = useState({
    service: inStateFulfillment?.service ?? 'delivery',
    address: inStateFulfillment?.address ?? '123 Main Street, Apt 4B, New York, NY 10001',
    coords: inStateFulfillment?.coords ?? null,
    date: inStateFulfillment?.date ?? toDateInput(now),
    time: inStateFulfillment?.time ?? toTimeInput(now),
  });

  // Restaurant data (placeholder if not coming from shared cart)
  const [restaurant] = useState(
    location.state?.restaurant || {
      id: 1,
      name: "Tony's Authentic Pizzeria",
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&h=300&fit=crop',
      rating: 4.8,
      distance: '0.8 miles',
      address: '', // will be filled by snapshot if available
    }
  );

  // Cart items - replaced by Supabase data when shared cart is loaded
  const [cartItems, setCartItems] = useState([]);

  const [sharedCartData, setSharedCartData] = useState(null);
  const [isSharedCart, setIsSharedCart] = useState(false);
  const [loading, setLoading] = useState(false);

  // ---- Order state (kept, but synchronized with Fulfillment) ----
  const [serviceType, setServiceType] = useState(() => inStateFulfillment?.service ?? 'delivery');
  const [deliveryAddress, setDeliveryAddress] = useState(() => inStateFulfillment?.address ?? '');

  const [pickupTime, setPickupTime] = useState('asap');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState('30-40 min');

  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const pad2 = (n) => String(n).padStart(2, '0');

  const mapMethods = (rows = []) => rows.map((m) => ({
    id: m.id,
    type: 'card',
    brand: m.brand,
    last4: m.last_four,
    expiry: m.exp_month && m.exp_year ? `${String(m.exp_month).padStart(2,'0')}/${String(m.exp_year).slice(-2)}` : '',
    isDefault: !!m.is_default,
    cardName: m.card_name,
  }));

  // Keep order state in sync when user changes the FulfillmentBar
  const handleFulfillmentChange = (next) => {
    setFulfillment(next);
    // Mirror into existing order state
    setServiceType(next.service);
    setServiceParam(next.service);
    setDeliveryAddress(next.address || '');
    setEstimatedTime(next.service === 'delivery' ? '30-40 min' : '20-25 min');
    if (next.service === 'pickup') setTipAmount(0);
  };

  // Keep FulfillmentBar in sync when toggles in other components change service type
  const handleServiceTypeChange = (type) => {
    setServiceType(type);
    setServiceParam(next.service);
    setEstimatedTime(type === 'delivery' ? '30-40 min' : '20-25 min');
    if (type === 'pickup') setTipAmount(0);
    setFulfillment((prev) => (prev.service === type ? prev : { ...prev, service: type }));
  };

  // Load shared cart data if available
  useEffect(() => {
    if (currentCartId && user?.id) {
      loadCartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCartId, user?.id]);

  // Real-time cart updates
  useEffect(() => {
    const handleCartItemsChange = (event) => {
      const { detail } = event;
      if (detail?.cartId === currentCartId) {
        loadCartData();
      }
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
      setSharedCartData(cartSnapshot);
      setIsSharedCart(true);
      // fallback normalize assignees from __assignment__ if needed:
      const items = (cartSnapshot.items || []).map((it) => {
        if (Array.isArray(it?.assignedTo) && it.assignedTo.length) return it;
        const a = it?.selectedOptions?.__assignment__ || it?.selected_options?.__assignment__;
        if (a?.display_names?.length) {
          return { ...it, assignedTo: a.display_names.map((n) => ({ name: n })) };
        }
        return it;
      });
      setCartItems(items);
      broadcastHeader(cartSnapshot);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const onRemove = (e) => {
      const { itemId } = e?.detail || {};
      if (!itemId) return;
      // Uses your existing shared/local logic
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
      },
    }));
  };

  // Totals
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

  // Validation
  const isFormValid = () =>
    cartItems?.length > 0 &&
    selectedPaymentMethod &&
    (serviceType === 'pickup' || (deliveryAddress || '').trim());

  // Event handlers (shared/local)
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
    setPromoDiscount(discounts?.[code] || 0);
  };

  const handlePlaceOrder = async () => {
    const orderData = {
      restaurant,
      items: cartItems,
      serviceType,
      deliveryAddress,
      pickupTime,
      paymentMethod: selectedPaymentMethod,
      tip: tipAmount,
      total,
    };

    if (isSharedCart && currentCartId) {
      try {
        // await sharedCartService?.convertCartToOrder(currentCartId, {
        //   delivery_address_line1: (deliveryAddress || '').split(',')?.[0] || '',
        //   delivery_city: 'City',
        //   delivery_state: 'State',
        //   delivery_zip: '12345',
        //   total_amount: total,
        //   service_fee_charged: 0,
        //   delivery_fee_charged: deliveryFee,
        // });

        await logCartActivity?.(currentCartId, 'order_placed', {
          total_amount: total,
          item_count: cartItems?.length,
        });

        console.log('Shared cart order placed:', orderData);
      } catch (error) {
        console.error('Error placing shared cart order:', error);
      }
    } else {
      console.log('Regular order placed:', orderData);
    }
  };

  // Update ETA when service type changes
  useEffect(() => {
    setEstimatedTime(serviceType === 'delivery' ? '30-40 min' : '20-25 min');
  }, [serviceType]);

  // Set active cart ID from URL if provided
  useEffect(() => {
    if (urlCartId && urlCartId !== activeCartId) {
      setActiveCartId?.(urlCartId);
    }
  }, [urlCartId, activeCartId, setActiveCartId]);


  // fetch payments
  useEffect(() => {
    const teamId = sharedCartData?.cart?.teamId || null;
    if (!user?.id) return;

    (async () => {
      setLoadingPayments(true);
      try {
        // if you want team-scoped methods, prefer getTeamPaymentMethods(teamId)
        const { data, error } = teamId
          ? await paymentService.getTeamPaymentMethods(teamId)
          : await paymentService.getPaymentMethods();

        if (error) return; // you can toast error.message if you want
        const methods = mapMethods(data);
        setSavedPaymentMethods(methods);
        setSelectedPaymentMethod((prev) =>
          prev ||
          methods.find((m) => m.isDefault)?.id ||
          methods[0]?.id ||
          ''
        );
      } finally {
        setLoadingPayments(false);
      }
    })();
  }, [user?.id, sharedCartData?.cart?.teamId]);

  const detectBrand = (digits) => {
    if (/^4/.test(digits)) return 'visa';
    if (/^(5[1-5])/.test(digits)) return 'mastercard';
    if (/^(34|37)/.test(digits)) return 'amex';
    if (/^6/.test(digits)) return 'discover';
    return 'card';
  };

  const handleAddCard = async (form) => {
    const digits = (form.number || '').replace(/\s+/g, '');
    const last4 = digits.slice(-4);
    const payload = {
      team_id: sharedCartData?.cart?.teamId || null,
      card_name: form.name?.trim() || 'Card',
      last_four: last4,
      is_default: savedPaymentMethods.length === 0, // first card -> default
    };

    const { data, error } = await paymentService.createPaymentMethod(payload);
    if (error) throw new Error(error.message || 'Failed to save card');

    // add a UI-only brand for icon (not saved to DB)
    const created = { ...mapMethods([data])[0], brand: detectBrand(digits) };
    setSavedPaymentMethods((prev) => [created, ...prev]);
    return created; // so PaymentSection can auto-select it
  };


  const provider = sharedCartData?.cart?.providerType || 'grubhub'; // default you prefer
  const paymentMode = PROVIDER_CONFIG[provider]?.paymentMode || 'external_redirect';
  const pickupAddress = sharedCartData?.restaurant?.address || location.state?.restaurant?.address || restaurant?.address || '';

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-32 md:pb-8">
        <div className="max-w-4xl mx-auto px-4 lg:px-6">
          {/* Back Navigation */}
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
            {/* Shared Cart Banner */}
            {isSharedCart && currentCartId && <SharedCartBanner cartId={currentCartId} />}

            {/* Restaurant Header with Share Button */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <RestaurantHeader
                  restaurant={sharedCartData?.restaurant || restaurant}
                  serviceType={serviceType}
                  onServiceTypeChange={handleServiceTypeChange}
                  estimatedTime={estimatedTime}
                />
              </div>

              {currentCartId && (
                <div className="ml-4">
                  <ShareCartButton cartId={currentCartId} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Cart Items & Details */}
              <div className="lg:col-span-2 space-y-6">
                {/* Cart Items */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-foreground">
                    Your Order ({cartItems?.length} {cartItems?.length === 1 ? 'item' : 'items'})
                  </h2>

                  {cartItems?.map((item) => (
                    <CartItemCard
                      key={item?.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemoveItem}
                      onEdit={handleEditItem}
                      showUserInfo={isSharedCart}
                    />
                  ))}
                </div>

                {/* Delivery / Pickup Details (kept, stays in sync with bar) */}
                <DeliveryInformation
                  serviceType={serviceType}
                  deliveryAddress={deliveryAddress}
                  onAddressChange={(addr) => {
                    setDeliveryAddress(addr);
                    setFulfillment((prev) => ({ ...prev, address: addr }));
                  }}
                  pickupTime={pickupTime}
                  onPickupTimeChange={setPickupTime}
                  pickupAddress={pickupAddress}
                />

                {/* Payment */}
                {paymentMode === 'self_hosted' ? (
                  <PaymentSection
                    selectedPaymentMethod={selectedPaymentMethod}
                    onPaymentMethodChange={setSelectedPaymentMethod}
                    savedPaymentMethods={savedPaymentMethods}
                    loadingPayments={loadingPayments}
                    onAddCard={handleAddCard} // can be a noop for now
                  />
                ) : (
                  <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
                    <h2 className="text-lg font-semibold">Payment</h2>
                    <p className="text-sm text-muted-foreground mt-2">
                      Payment is handled securely by {provider === 'mealme' ? 'MealMe' : provider}.
                    </p>
                    <Button
                      className="mt-4"
                      onClick={async () => {
                        // 1) Price/lock the order via provider API
                        // 2) Get checkout/deeplink URL
                        const url = await providerService.startCheckout({
                          provider,
                          cartId: currentCartId,
                          providerRestaurantId: sharedCartData?.cart?.providerRestaurantId,
                        });
                        window.location.href = url; // send user to hosted checkout
                      }}
                    >
                      Continue to {provider === 'mealme' ? 'MealMe' : 'Checkout'}
                    </Button>
                  </div>
                )}

                {/* Tip */}
                <TipSelection
                  serviceType={serviceType}
                  subtotal={subtotal}
                  selectedTip={tipAmount}
                  onTipChange={setTipAmount}
                />
              </div>

              {/* Right Column - Summary */}
              <div className="lg:col-span-1">
                <div className="sticky top-32">
                  <OrderSummary
                    subtotal={subtotal}
                    deliveryFee={deliveryFee}
                    tax={tax}
                    discount={promoDiscount}
                    total={total}
                    serviceType={serviceType}
                    onPromoCodeApply={handlePromoCodeApply}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Checkout Button (mobile sticky) */}
      <CheckoutButton
        total={total}
        isValid={isFormValid()}
        serviceType={serviceType}
        estimatedTime={estimatedTime}
        onPlaceOrder={handlePlaceOrder}
      />
    </div>
  );
};

export default ShoppingCartCheckout;