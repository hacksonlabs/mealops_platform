import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/custom/Button';
import RestaurantHeader from './components/RestaurantHeader';
import OrderSummary from './components/OrderSummary';
import DeliveryInformation from './components/DeliveryInformation';
import PaymentSection from './components/PaymentSection';
import TipSelection from './components/TipSelection';
import CheckoutButton from './components/CheckoutButton';
import AccountDetailsSection from './components/AccountDetailsSection';        // NEW
import TeamAssignments from './components/TeamAssignments';                    // NEW
import OrderItemsModal from './components/OrderItemsModal';                    // NEW
import { useSharedCart } from '../../contexts/SharedCartContext';
import { useAuth } from '../../contexts/AuthContext';
import sharedCartService from '../../services/sharedCartService';
import cartDbService from '../../services/cartDBService';
import { paymentService } from '../../services/paymentService';
import providerService from '../../services/providerService';
import { PROVIDER_CONFIG } from '../../services/paymentService';

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
  const [estimatedTime, setEstimatedTime] = useState('30-40 min');

  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const lineQty = (it) => {
    const raw = Number(it?.quantity);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  };
  
  const orderItemsCount = useMemo(
    () => (cartItems || []).reduce((n, it) => n + lineQty(it), 0),
    [cartItems]
  );

  // NEW: Account details
  const [account, setAccount] = useState({
    contactName: user?.user_metadata?.full_name || user?.full_name || '',
    email: user?.email || '',
    phone: '',
    teamName: sharedCartData?.cart?.teamName || ''
  });

  // NEW: items modal
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

  // FIX: this referenced "next" (undefined) before
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
      // HYDRATE fulfillment from DB snapshot
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
        const a = it?.selectedOptions?.__assignment__ || it?.selected_options?.__assignment__;
        if (a?.display_names?.length) {
          return { ...it, assignedTo: a.display_names.map((n) => ({ name: n })) };
        }
        return it;
      });
      setCartItems(items);
      broadcastHeader(cartSnapshot);

      // update team name default if present
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

  const isFormValid = () =>
    cartItems?.length > 0 &&
    selectedPaymentMethod &&
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
      account,
    };

    if (isSharedCart && currentCartId) {
      try {
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

  useEffect(() => {
    setEstimatedTime(serviceType === 'delivery' ? '30-40 min' : '20-25 min');
  }, [serviceType]);

  useEffect(() => {
    if (urlCartId && urlCartId !== activeCartId) {
      setActiveCartId?.(urlCartId);
    }
  }, [urlCartId, activeCartId, setActiveCartId]);

  useEffect(() => {
    const teamId = sharedCartData?.cart?.teamId || null;
    if (!user?.id) return;

    (async () => {
      setLoadingPayments(true);
      try {
        const { data, error } = teamId
          ? await paymentService.getTeamPaymentMethods(teamId)
          : await paymentService.getPaymentMethods();
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
      is_default: savedPaymentMethods.length === 0,
    };

    const { data, error } = await paymentService.createPaymentMethod(payload);
    if (error) throw new Error(error.message || 'Failed to save card');

    const created = { ...mapMethods([data])[0], brand: detectBrand(digits) };
    setSavedPaymentMethods((prev) => [created, ...prev]);
    return created;
  };

  const provider = sharedCartData?.cart?.providerType || 'grubhub';
  const paymentMode = PROVIDER_CONFIG[provider]?.paymentMode || 'external_redirect';
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
        />

        <Button
          className="w-full h-12 text-base font-semibold mt-6 hidden lg:block"
          onClick={handlePlaceOrder}
          disabled={!isFormValid()}
          iconName={serviceType === 'delivery' ? 'Truck' : 'ShoppingBag'}
          iconPosition="left"
        >
          Place {serviceType === 'delivery' ? 'Delivery' : 'Pickup'} Order
        </Button>

        {!isFormValid() && (
          <p className="hidden lg:block text-xs text-error mt-2">
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
                  pickupTime={pickupTime}
                  onPickupTimeChange={setPickupTime}
                  pickupAddress={pickupAddress}
                  pickupName={pickupName}
                />

                {/* Payment */}
                {paymentMode === 'self_hosted' ? (
                  <PaymentSection
                    selectedPaymentMethod={selectedPaymentMethod}
                    onPaymentMethodChange={setSelectedPaymentMethod}
                    savedPaymentMethods={savedPaymentMethods}
                    loadingPayments={loadingPayments}
                    onAddCard={handleAddCard}
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
                        const url = await providerService.startCheckout({
                          provider,
                          cartId: currentCartId,
                          providerRestaurantId: sharedCartData?.cart?.providerRestaurantId,
                        });
                        window.location.href = url;
                      }}
                    >
                      Continue to {provider === 'mealme' ? 'MealMe' : 'Checkout'}
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

      {/* Mobile sticky checkout (kept, but hidden on desktop) */}
      <div className="lg:hidden">
        <CheckoutButton
          total={total}
          isValid={isFormValid()}
          serviceType={serviceType}
          estimatedTime={estimatedTime}
          onPlaceOrder={handlePlaceOrder}
        />
      </div>

      {/* Items modal */}
      <OrderItemsModal
        open={showItemsModal}
        onClose={() => setShowItemsModal(false)}
        items={cartItems}
      />
    </div>
  );
};

export default ShoppingCartCheckout;
