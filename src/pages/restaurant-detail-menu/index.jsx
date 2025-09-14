import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import FulfillmentBar from '../../components/ui/FulfillmentBar';
import RestaurantHero from './components/RestaurantHero';
import MenuSearch from './components/MenuSearch';
import MenuSection from './components/MenuSection';
import ItemCustomizationModal from './components/ItemCustomizationModal';
import RestaurantInfo from './components/RestaurantInfo';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import cartDbService from '../../services/cartDBService';
import { useAuth } from '../../contexts';
import { useProvider } from '../../contexts/ProviderContext';
import { useSharedCart } from '../../contexts/SharedCartContext';
import ProviderToggle from './components/ProviderToggle';
import { fetchMenu, pickDefaultProvider } from '../../services/menuProviderService';
import InfoTooltip from '../../components/ui/InfoTooltip';
import { computeDistanceMeters, metersToMiles, geocodeAddress } from '../../utils/googlePlaces';

// helpers
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const EXTRA_SENTINEL = '__EXTRA__'; // keep in sync with modal

function slugifyId(str = '') {
  return String(str).toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
}

const RestaurantDetailMenu = () => {
  const navigate = useNavigate();
  const { restaurantId } = useParams(); // support /restaurant/:restaurantId
  const location = useLocation();
  const { activeTeam } = useAuth();
  const { provider, setProvider } = useProvider();
  const [providerFlatMenu, setProviderFlatMenu] = useState([]);
  const [localProvider, setLocalProvider] = useState(provider); // page-local until user adds to cart
  const { setActiveCartId } = useSharedCart();
  const [loadingMenu, setLoadingMenu] = useState(false);
  const [providerError, setProviderError] = useState('');
  const syncServiceToUrl = useCallback((svc) => {
    const qs = new URLSearchParams(location.search);
    if (svc) qs.set('service', svc);
    else qs.delete('service');
    navigate({ search: qs.toString() }, { replace: true });
  }, [location.search, navigate]);

  const [fulfillment, setFulfillment] = useState(() => {
    const fromState = location.state?.fulfillment;
    const now = new Date();
    return {
      service: fromState?.service ?? 'delivery',
      address: fromState?.address ?? '',
      coords: fromState?.coords ?? null,
      date: fromState?.date ?? toDateInput(now),
      time: fromState?.time ?? toTimeInput(now),
    };
  });

  const [selectedService, setSelectedService] = useState(
    location.state?.fulfillment?.service ?? 'delivery'
  );

  const [cartId, setCartId] = useState(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [showRestaurantInfo, setShowRestaurantInfo] = useState(false);
  const [computedDistanceMi, setComputedDistanceMi] = useState();

  // fetched data
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [menuRaw, setMenuRaw] = useState([]); // flat rows from menu_items
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  // If we came here via "Edit" from the header drawer/checkout, this will be populated
  const editState = location.state?.editItem || null;

  // Prefill/preset for the modal if the selected item matches the thing we’re editing
  const presetForSelected = useMemo(() => {
    if (!selectedItem || !editState) return undefined;

    const editedMenuItemId = editState.menuItemId || editState.menu_items?.id || editState.id;
    if (editedMenuItemId !== selectedItem.id) return undefined;

    // Prefer authoritative assignment block from selected_options
    let assignedTo = null;
    const asg = editState.selectedOptions?.__assignment__ || null;
    if (asg) {
      const members = Array.isArray(asg.member_ids) ? asg.member_ids.map((id) => ({ id })) : [];
      const extras = Array.from({ length: Number(asg.extra_count || 0) }, () => ({ id: EXTRA_SENTINEL, name: 'Extra' }));
      assignedTo = [...members, ...extras];
    }
    if (!assignedTo || assignedTo.length === 0) {
      assignedTo = editState.assignedTo || (editState.userName ? [{ name: editState.userName }] : null);
    }

    return {
      quantity: Number(editState.quantity || 1),
      selectedOptions: editState.selectedOptions ?? null,
      selectedToppings: editState.selectedToppings ?? null,
      selectedSize: editState.selectedSize ?? null,
      specialInstructions: editState.specialInstructions || '',
      assignedTo,
      // IMPORTANT: these two determine "editing" mode
      cartRowId: editState.rowId || editState.id || null, // local rowId OR shared order_items.id
      cartId: location.state?.cartId || null, // shared cart id if present
      menuItemId: editedMenuItemId,
    };
  }, [selectedItem, editState, location.state?.cartId]);

  useEffect(() => {
    if (!restaurant) return;
    const providers = restaurant.supported_providers?.length
      ? restaurant.supported_providers
      : ['grubhub'];
    // default provider for this restaurant (grubhub > ue > dd)
    const def = pickDefaultProvider(providers);
    setLocalProvider(prev => prev || def);
  }, [restaurant]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMenu(true);
      setProviderError('');
      try {
        if (!restaurant || !localProvider) return;
        const items = await fetchMenu({
          provider: localProvider,
          restaurant,
        });
        if (!cancelled) setProviderFlatMenu(items);
      } catch (e) {
        if (!cancelled) setProviderError('Failed to load menu for this provider.');
      } finally {
        if (!cancelled) setLoadingMenu(false);
      }
    })();
    return () => { cancelled = true; };
  }, [localProvider, restaurant]);

  // Pull fulfillment from URL if present
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const svc = qs.get('service');
    const address =
      qs.get('delivery_address') ||
      qs.get('pickup_address') ||
      qs.get('address') ||
      '';
    const whenISO = qs.get('whenISO');
    const date = qs.get('date');
    const time = qs.get('time');
    const lat = qs.get('lat');
    const lng = qs.get('lng');

    setFulfillment((prev) => ({
      ...prev,
      service: svc === 'delivery' || svc === 'pickup' ? svc : prev.service,
      address: address || prev.address,
      coords: lat && lng ? { lat: +lat, lng: +lng } : prev.coords,
      date: date || (whenISO ? toDateInput(new Date(whenISO)) : prev.date),
      time: time || (whenISO ? toTimeInput(new Date(whenISO)) : prev.time),
    }));

    if (svc === 'delivery' || svc === 'pickup') setSelectedService(svc);
  }, [location.search]);

  // add once, near the top of the file
  const needsHydration = (r) => {
    if (!r) return true;
    const hasRating = Number.isFinite(Number(r.rating));
    const hasLoc = !!(r._coords || (r.lat && r.lng) || r.address);
    return !hasRating || !hasLoc;
  };

  // fetch restaurant (only if needed); always fetch menu by restaurant id
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        let rest = restaurant;

        // Hydrate only if missing rating and/or any loc to compute distance
        if (!rest || needsHydration(rest)) {
          const { data, error } = await supabase
            .from('restaurants')
            .select('id, name, image_url, cuisine_type, rating, phone_number, address, is_available, supports_catering, delivery_fee, minimum_order, supported_providers, provider_restaurant_ids, api_id')
            .or(`id.eq.${restaurantId},api_id.eq.${restaurantId}`)
            .maybeSingle();

          if (error) throw error;
          if (!data) throw new Error('Restaurant not found');

          // IMPORTANT: merge so anything already on rest (e.g., provider ids) survives
          rest = { ...rest, ...data };
        }

        // Always fetch menu once we know rest.id
        const { data: mi, error: miErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (miErr) throw miErr;

        if (!cancelled) {
          const inboundDistance = location.state?.restaurant?.distance;
          setRestaurant(prev => ({
            ...prev,
            ...rest,
            // keep distance from nav state if present; DB doesn’t store “distance”
            distance: prev?.distance ?? inboundDistance ?? rest.distance
          }));
          setMenuRaw(mi || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load restaurant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!restaurant) return;

      // Prefer known coords on both ends
      const rCoords =
        restaurant._coords ||
        (restaurant.lat && restaurant.lng ? { lat: Number(restaurant.lat), lng: Number(restaurant.lng) } : null) ||
        (restaurant.address ? await geocodeAddress(restaurant.address) : null);

      const uCoords =
        fulfillment?.coords ||
        (fulfillment?.address ? await geocodeAddress(fulfillment.address) : null);

      if (!rCoords || !uCoords) return;

      const meters = await computeDistanceMeters(rCoords, uCoords);
      if (!cancelled) setComputedDistanceMi(metersToMiles(meters));
    })();
    return () => { cancelled = true; };
  }, [restaurant, fulfillment?.coords, fulfillment?.address]);


  // Transform the **DB menu** (menuRaw) – kept for edit flow compatibility
  const { dbMenuItemsByCat, dbMenuCategories } = useMemo(() => {
    const groups = new Map(); // id -> { id, name, items: [] }
    for (const row of menuRaw) {
      const name = row.category || 'Menu';
      const id = slugifyId(name);
      if (!groups.has(id)) groups.set(id, { id, name, items: [] });
      groups.get(id).items.push({
        id: row.id,
        name: row.name,
        description: row.description || '',
        price: row.price ?? 0,
        image: row.image_url || '',
        isPopular: false,
        calories: row.calories ?? undefined,
        dietaryInfo: row.dietary_info ?? undefined,
        hasCustomizations: !!row.options_json,
        options: row.options_json || null,
        sizes: row.sizes_json || [],
        toppings: row.toppings_json || [],
        category: row.category || 'Menu',
      });
    }

    // Build arrays
    const cats = Array.from(groups.values()).map((g) => ({
      id: g.id,
      name: g.name,
      itemCount: g.items.length,
      description: '',
    }));

    cats.sort((a, b) => a.name.localeCompare(b.name));

    const itemsByCat = {};
    for (const g of cats) {
      itemsByCat[g.id] = groups.get(g.id).items;
    }

    return { dbMenuItemsByCat: itemsByCat, dbMenuCategories: cats };
  }, [menuRaw]);

  // Transform the **provider menu** (flat -> grouped like DB)
  const { providerItemsByCat, providerCategories } = useMemo(() => {
    const groups = new Map();
    for (const it of providerFlatMenu || []) {
      const name = it.category || 'Menu';
      const id = slugifyId(name);
      if (!groups.has(id)) groups.set(id, { id, name, items: [] });
      groups.get(id).items.push({
        id: it.id,
        name: it.name,
        description: it.description || '',
        price: Number(it.price ?? 0),
        image: it.image || it.image_url || '',
        isPopular: !!it.isPopular,
        calories: it.calories ?? undefined,
        dietaryInfo: it.dietaryInfo ?? undefined,
        hasCustomizations: !!(it.options || it.options_json || it.sizes || it.toppings),
        options: it.options || it.options_json || null,
        sizes: it.sizes || [],
        toppings: it.toppings || [],
        category: it.category || 'Menu',
      });
    }
    const cats = Array.from(groups.values()).map((g) => ({
      id: g.id,
      name: g.name,
      itemCount: g.items.length,
      description: '',
    }));
    cats.sort((a, b) => a.name.localeCompare(b.name));
    const itemsByCat = {};
    for (const g of cats) itemsByCat[g.id] = groups.get(g.id).items;
    return { providerItemsByCat: itemsByCat, providerCategories: cats };
  }, [providerFlatMenu]);

  // Set initial active category based on provider categories
  useEffect(() => {
    if (!activeCategory && providerCategories?.length) {
      setActiveCategory(providerCategories[0].id);
    }
  }, [providerCategories, activeCategory]);

  // Filter menu items based on search query
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery) return providerItemsByCat;
    const q = searchQuery.toLowerCase();
    const filtered = {};
    Object.keys(providerItemsByCat || {}).forEach((cid) => {
      const items = (providerItemsByCat[cid] || []).filter(
        (item) =>
          item?.name?.toLowerCase()?.includes(q) ||
          item?.description?.toLowerCase()?.includes(q)
      );
      if (items.length) filtered[cid] = items;
    });
    return filtered;
  }, [providerItemsByCat, searchQuery]);

  // Scroll spy for category nav (if you add it back in)
  useEffect(() => {
    const handleScroll = () => {
      const categories = Object.keys(filteredMenuItems || {});
      const scrollPosition = window.scrollY + 200;
      for (let i = categories.length - 1; i >= 0; i--) {
        const el = document.getElementById(`category-${categories[i]}`);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveCategory(categories[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredMenuItems]);

  const handleServiceToggle = (service) => {
    setSelectedService(service);
    setFulfillment((prev) => ({ ...prev, service }));
    syncServiceToUrl(service);
  };

  const handleCategoryChange = (categoryId) => setActiveCategory(categoryId);
  const handleSearch = (q) => setSearchQuery(q);
  const handleClearSearch = () => setSearchQuery('');

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsCustomizationModalOpen(true);
    window.dispatchEvent(new Event('closeCartDrawer'));
  };

  const handleBackClick = () => navigate('/home-restaurant-discovery');

  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const inboundDistance = useMemo(
    () => {
      const v = location.state?.restaurant?.distance;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    },
    [location.state?.restaurant?.distance]
  );

  // Map DB restaurant to your hero/info expectations
  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image || '',
      cuisine: restaurant.cuisine_type || restaurant.cuisine || '',
      rating: toNum(restaurant.rating),
      distance: inboundDistance ?? toNum(restaurant.distance) ?? computedDistanceMi,
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      priceRange: undefined,
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone_number || '',
      address: restaurant.address || restaurant._address || '',
      coordinates: restaurant._coords || undefined,
      deliveryRadius: undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [],
      ratingBreakdown: [],
      reviews: [],
    };
  }, [restaurant, location.state?.restaurant?.distance, computedDistanceMi]);

  const handleFulfillmentChange = async (next) => {
    setFulfillment(next);
    if (next.service !== selectedService) setSelectedService(next.service);
    syncServiceToUrl(next.service);
    window.dispatchEvent(
      new CustomEvent('deliveryAddressUpdate', {
        detail: { address: next.address, lat: next.coords ?? null },
      })
    );
    // If there's an active cart on this page, mirror fulfillment to DB
    try {
      if (cartId) {
        await cartDbService.upsertCartFulfillment(cartId, next, {
          title: `${restaurant?.name || 'Cart'} • ${localProvider}`,
          providerType: localProvider,
          providerRestaurantId: restaurant?.provider_restaurant_ids?.[localProvider] || null,
        });
      }
    } catch (_) {}
  };

  // Open modal when navigating here from "Edit" in the header drawer
  useEffect(() => {
    const edit = location.state?.editItem;
    if (!edit || !menuRaw?.length) return;

    const menuItemId = edit.menuItemId || edit.id;
    const row = menuRaw.find((r) => r.id === menuItemId);
    if (!row) return;

    const mapped = {
      id: row.id,
      name: row.name,
      description: row.description || '',
      price: row.price ?? 0,
      image: row.image_url || '',
      sizes: row.sizes_json || [],
      toppings: row.toppings_json || [],
      options: row.options_json || null,
      category: row.category || 'Menu',
    };

    setSelectedItem(mapped);
    setIsCustomizationModalOpen(true);
    window.dispatchEvent(new Event('closeCartDrawer'));
  }, [location.state?.editItem, menuRaw]);

  // If we navigated from the hub with a known cartId, hydrate the drawer and open it
  useEffect(() => {
    const incoming = location.state?.cartId;
    const openCartOnLoad = location.state?.openCartOnLoad === true;
    if (!incoming) return;

    setCartId(incoming);
    setActiveCartId?.(incoming);

    (async () => {
      const snap = await cartDbService.getCartSnapshot(incoming);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count,
          total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: incoming,
          restaurant: snap.restaurant,
          items: snap.items,
          // use fulfillment passed via navigation if present; fallback to current page state
          fulfillment: location.state?.fulfillment || fulfillment,
        },
      }));
      if (openCartOnLoad) {
        window.dispatchEvent(new Event('openCartDrawer'));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.cartId]);

  // Lookup an existing cart for this restaurant/provider (but don't override a known incoming cartId)
  useEffect(() => {
    if (!activeTeam?.id || !restaurant?.id) return;
    if (location.state?.cartId) return; // already set from navigation
    let cancelled = false;
    (async () => {
      const id = await cartDbService.findActiveCartForRestaurant(activeTeam.id, restaurant.id, provider);
      if (!id || cancelled) return;
      setCartId(id);
      const snap = await cartDbService.getCartSnapshot(id);
      if (!snap || cancelled) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count,
          total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
          fulfillment,
        },
      }));
    })();
    return () => { cancelled = true; };
  }, [activeTeam?.id, restaurant?.id, provider, location.state?.cartId]); // note cartId dependency omitted on purpose

  // Subscribe to realtime changes to keep drawer fresh (optional but nice)
  useEffect(() => {
    if (!cartId) return;
    const unsubscribe = cartDbService.subscribeToCart(cartId, async () => {
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (!snap) return;
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count,
          total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: snap.cart.id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    });
    return unsubscribe;
  }, [cartId]);

  const handleAddToCart = async (customizedItem, quantity) => {
    let id = cartId;
    if (!id) {
      if (!activeTeam?.id || !restaurant?.id) return;
      id = await cartDbService.ensureCartForRestaurant(
        activeTeam.id,
        restaurant.id,
        {
          title: `${restaurant.name} • ${localProvider}`,
          providerType: localProvider,
          providerRestaurantId: restaurant?.provider_restaurant_ids?.[localProvider] || null,
        }
      );
      // persist current fulfillment on first create (safe to call on existing, too)
      await cartDbService.upsertCartFulfillment(id, fulfillment, {
        title: `${restaurant.name} • ${localProvider}`,
        providerType: localProvider,
        providerRestaurantId: restaurant?.provider_restaurant_ids?.[localProvider] || null,
      });
      setCartId(id);
      setProvider(localProvider);
    }

    // Build assignment snapshot for header (“For: name(s)” incl. Extra)
    const memberIds = (customizedItem.assignedTo || [])
      .map(a => a?.id)
      .filter(Boolean); // only real member UUIDs (EXTRA sentinel handled below)
    const extraCount = (customizedItem.assignedTo || []).filter(a => a?.name === 'Extra' || a?.id === EXTRA_SENTINEL).length;
    const displayNames = (customizedItem.assignedTo || []).map(a => a?.name).filter(Boolean);

    const selectedOptions = customizedItem.selectedOptions || {};
    const unitPrice = typeof customizedItem.customizedPrice === 'number'
      ? customizedItem.customizedPrice
      : Number(customizedItem.price || 0);

    // If this came from an Edit (DB row id present), update; else insert
    if (customizedItem.cartRowId) {
      const selWithAssign = {
        ...selectedOptions,
        __assignment__: { member_ids: memberIds, extra_count: extraCount, display_names: displayNames },
      };
      await cartDbService.updateItem(id, customizedItem.cartRowId, {
        quantity,
        price: unitPrice,
        special_instructions: customizedItem.specialInstructions || '',
        selected_options: selWithAssign,
      });
    } else {
      await cartDbService.addItem(id, {
        menuItem: { id: customizedItem.id, name: customizedItem.name, image: customizedItem.image },
        quantity,
        unitPrice,
        specialInstructions: customizedItem.specialInstructions || '',
        selectedOptions,
        assignment: { memberIds, extraCount, displayNames },
      });
    }

    // Refresh header drawer snapshot
    const snap = await cartDbService.getCartSnapshot(id);
    if (snap) {
      const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
      const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
      window.dispatchEvent(new CustomEvent('cartBadge', {
        detail: {
          count,
          total,
          name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
          cartId: id,
          restaurant: snap.restaurant,
          items: snap.items,
        },
      }));
    }
  };

  // Drawer "Remove" -> delete from DB
  useEffect(() => {
    const onRemove = async (e) => {
      const { cartId: evtCartId, itemId } = e?.detail || {};
      if (!itemId || !evtCartId || evtCartId !== cartId) return;
      await cartDbService.removeItem(cartId, itemId);
      const snap = await cartDbService.getCartSnapshot(cartId);
      if (snap) {
        const count = snap.items.reduce((n, it) => n + Number(it.quantity || 0), 0);
        const total = snap.items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0);
        window.dispatchEvent(new CustomEvent('cartBadge', {
          detail: {
            count,
            total,
            name: snap.restaurant?.name ? `${snap.restaurant.name} • Cart` : 'Cart',
            cartId: snap.cart.id,
            restaurant: snap.restaurant,
            items: snap.items,
          },
        }));
      }
    };
    window.addEventListener('cartItemRemove', onRemove);
    return () => window.removeEventListener('cartItemRemove', onRemove);
  }, [cartId]);

  useEffect(() => {
    if (isCustomizationModalOpen) {
      window.dispatchEvent(new Event('closeCartDrawer'));
      window.dispatchEvent(new Event('closeCartHub'));
    }
  }, [isCustomizationModalOpen]);



  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16 [--sticky-top:64px] md:[--sticky-top:96px]">
          <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-1/3 bg-muted rounded" />
              <div className="h-48 w-full bg-muted rounded" />
              <div className="h-6 w-1/4 bg-muted rounded" />
              <div className="h-6 w-1/2 bg-muted rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (err) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="pt-16">
          <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />
          <div className="p-6">
            <div className="text-error">Error: {err}</div>
            <Button className="mt-4" onClick={() => navigate('/home-restaurant-discovery')}>
              Back to discovery
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16">
        <FulfillmentBar value={fulfillment} onChange={handleFulfillmentChange} />

        {/* Mobile Back/Header */}
        <div className="md:hidden sticky top-24 z-30 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button variant="ghost" size="icon" onClick={handleBackClick}>
              <Icon name="ArrowLeft" size={20} />
            </Button>
            <h1 className="text-lg font-semibold text-foreground truncate mx-4">
              {restaurant?.name}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowRestaurantInfo((s) => !s)}
            >
              <Icon name="Info" size={20} />
            </Button>
          </div>
        </div>

        <div className="flex">
          {/* Left sidebar category nav can go here */}

          {/* Main */}
          <div className="flex-1">
            <RestaurantHero
              restaurant={heroRestaurant}
              selectedService={selectedService}
              onServiceToggle={handleServiceToggle}
              rightContent={
                <div className="w-full md:w-80">
                  <MenuSearch
                    searchQuery={searchQuery}
                    onSearch={handleSearch}
                    onClearSearch={handleClearSearch}
                  />
                </div>
              }
              belowTitleContent={
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Order Handled By:
                    <InfoTooltip
                      text="Fees and service charges are set by the provider and may vary by location, time, and promotions."
                    />
                  </div>
                  <ProviderToggle
                    providers={restaurant?.supported_providers || ['grubhub']}
                    selected={localProvider}
                    onChange={setLocalProvider}
                    showIcons={false}
                  />
                </div>
              }
            />

            {providerError && <p className="text-sm text-destructive mt-2">{providerError}</p>}
            {loadingMenu && (
              <div className="animate-pulse text-sm text-muted-foreground px-4">Loading menu…</div>
            )}

            {/* Menu Content */}
            <div className="px-4 md:px-6 pb-32">
              {Object.keys(filteredMenuItems || {}).length === 0 ? (
                <div className="text-center py-12">
                  <Icon name="Search" size={48} className="text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No items found</h3>
                  <p className="text-muted-foreground">
                    Try searching for something else or browse our menu categories.
                  </p>
                  <Button variant="outline" onClick={handleClearSearch} className="mt-4">
                    Clear Search
                  </Button>
                </div>
              ) : (
                Object.keys(filteredMenuItems).map((categoryId) => {
                  const category = providerCategories.find((c) => c.id === categoryId);
                  const items = filteredMenuItems[categoryId];
                  return (
                    <MenuSection
                      key={categoryId}
                      category={category}
                      items={items}
                      onAddToCart={handleAddToCart}
                      onItemClick={handleItemClick}
                    />
                  );
                })
              )}

              {/* Restaurant Information Section */}
              {showRestaurantInfo && <RestaurantInfo restaurant={heroRestaurant} />}
            </div>
          </div>
        </div>

        {/* Item Customization Modal */}
        <ItemCustomizationModal
          item={selectedItem}
          isOpen={isCustomizationModalOpen}
          onClose={() => {
            setIsCustomizationModalOpen(false);
            setSelectedItem(null);
            // Clear edit state so the modal doesn't keep showing "Save changes"
            if (editState) {
              navigate('.', { replace: true, state: {} });
            }
          }}
          preset={presetForSelected}
          onAddToCart={handleAddToCart}
        />
      </main>
    </div>
  );
};

export default RestaurantDetailMenu;