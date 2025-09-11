// src/pages/restaurant-detail-menu/index.jsx
import React, { useEffect, useMemo, useState } from 'react';
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
import cartService from '../../services/cartService';
import sharedCartService from '../../services/sharedCartService';

// helpers
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function slugifyId(str = '') {
  return String(str).toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
}

const makeRowId =
  () =>
    (globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

const RestaurantDetailMenu = () => {
  const navigate = useNavigate();
  const { restaurantId } = useParams(); // support /restaurant/:restaurantId
  const location = useLocation();

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

  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);

  // Local cart on this page (non-shared)
  // Each entry MUST carry a unique rowId to avoid duplicate React keys.
  const [cartItems, setCartItems] = useState([]);
  const [showRestaurantInfo, setShowRestaurantInfo] = useState(false);

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

    return {
      quantity: Number(editState.quantity || 1),
      selectedOptions: editState.selectedOptions ?? null,
      selectedToppings: editState.selectedToppings ?? null,
      selectedSize: editState.selectedSize ?? null,
      specialInstructions: editState.specialInstructions || '',
      assignedTo:
        editState.assignedTo || (editState.userName ? [{ name: editState.userName }] : null),
      // IMPORTANT: these two determine "editing" mode
      cartRowId: editState.rowId || editState.id || null, // local rowId OR shared order_items.id
      cartId: location.state?.cartId || null, // shared cart id if present
      menuItemId: editedMenuItemId,
    };
  }, [selectedItem, editState, location.state?.cartId]);

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

  // fetch restaurant if not passed via state; always fetch menu by restaurant id
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setErr(null);
      try {
        // Resolve restaurant record
        let rest = restaurant;
        if (!rest) {
          // Try by UUID id param first; fall back to api_id if someone routed that way.
          const { data: r1, error: e1 } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .maybeSingle();

          if (e1) throw e1;

          if (!r1) {
            const { data: r2, error: e2 } = await supabase
              .from('restaurants')
              .select('*')
              .eq('api_id', restaurantId)
              .maybeSingle();
            if (e2) throw e2;
            if (!r2) throw new Error('Restaurant not found');
            rest = r2;
          } else {
            rest = r1;
          }
        }

        // Fetch menu items for this restaurant
        const { data: mi, error: miErr } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('category', { ascending: true })
          .order('name', { ascending: true });

        if (miErr) throw miErr;

        if (!cancelled) {
          const inboundDistance = location.state?.restaurant?.distance;
          const merged = (inboundDistance != null)
            ? { ...rest, distance: inboundDistance }
            : rest;
          setRestaurant(merged);
          setMenuRaw(mi || []);
        }
      } catch (e) {
        if (!cancelled) setErr(e?.message || 'Failed to load restaurant');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  // Transform flat menu into grouped shape your UI expects
  const { menuItems, menuCategories } = useMemo(() => {
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

    return { menuItems: itemsByCat, menuCategories: cats };
  }, [menuRaw]);

  // set initial active category after categories are ready
  useEffect(() => {
    if (!activeCategory && menuCategories?.length) {
      setActiveCategory(menuCategories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuCategories]);

  // Filter menu items based on search query
  const filteredMenuItems = useMemo(() => {
    if (!searchQuery) return menuItems;
    const q = searchQuery.toLowerCase();
    const filtered = {};
    Object.keys(menuItems || {}).forEach((cid) => {
      const items = (menuItems[cid] || []).filter(
        (item) =>
          item?.name?.toLowerCase()?.includes(q) ||
          item?.description?.toLowerCase()?.includes(q)
      );
      if (items.length) filtered[cid] = items;
    });
    return filtered;
  }, [menuItems, searchQuery]);

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
  };

  const handleCategoryChange = (categoryId) => setActiveCategory(categoryId);
  const handleSearch = (q) => setSearchQuery(q);
  const handleClearSearch = () => setSearchQuery('');

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setIsCustomizationModalOpen(true);
  };

  /**
   * IMPORTANT: Every place we send data to the header cart drawer,
   * we must ensure each item has a UNIQUE `id` for React keys.
   * For local cart items we use `rowId`. For shared-cart items we keep DB `order_items.id`.
   */
  const broadcastHeaderCart = ({ items, restaurantInfo, cartId = null }) => {
    const count = items.reduce((s, it) => s + Number(it.quantity || 1), 0);
    const total = items.reduce((s, it) => {
      const unit = typeof it.customizedPrice === 'number' ? it.customizedPrice : Number(it.price || 0);
      return s + unit * Number(it.quantity || 1);
    }, 0);

    const itemsForDrawer = items.map((it) => ({
      id: it.rowId || it.id, // local uses rowId, shared uses DB id
      name: it.name,
      quantity: it.quantity,
      price: typeof it.customizedPrice === 'number' ? it.customizedPrice : Number(it.price || 0),
      image: it.image,
      selectedOptions: it.selectedOptions,
      specialInstructions: it.specialInstructions,
      assignedTo: it.assignedTo || [],
      // ensure the menu item id is available for "Edit" to resolve the correct item
      menuItemId: it.menuItemId || it.id, // local: menu item id is `id`, shared: `menu_items.id` (map upstream as needed)
      // For shared carts edited from elsewhere we may also provide userName
      userName: it.userName,
    }));

    window.dispatchEvent(
      new CustomEvent('cartBadge', {
        detail: {
          count,
          total,
          name: restaurantInfo?.name ? `${restaurantInfo.name} • Cart` : 'Cart',
          cartId,
          restaurant: restaurantInfo
            ? { id: restaurantInfo.id, name: restaurantInfo.name, image: restaurantInfo.image_url || restaurantInfo.image }
            : null,
          items: itemsForDrawer,
        },
      })
    );
  };

  const handleAddToCart = async (item, quantity) => {
    const isEditing = !!item?.cartRowId;

    // --- EDITING A SHARED-CART ROW ---
    if (isEditing && item?.cartId) {
      try {
        await cartService.updateCartItemDetails(item.cartId, item.cartRowId, {
          quantity,
          selected_options: item.selectedOptions || null,
          special_instructions: item.specialInstructions || '',
          price:
            typeof item.customizedPrice === 'number'
              ? item.customizedPrice
              : Number(item.price || 0),
        });

        // Let other pages (checkout) refetch themselves
        window.dispatchEvent(
          new CustomEvent('cartItemsChanged', { detail: { cartId: item.cartId } })
        );

        // Nice UX: refresh the header drawer snapshot
        const data = await sharedCartService.getSharedCart(item.cartId);
        const sharedItems =
          (data?.order_items || []).map((it) => ({
            id: it.id, // DB row id - unique
            name: it.item_name || it.menu_items?.name,
            quantity: it.quantity || 1,
            price: it.price || 0,
            image: it.menu_items?.image_url,
            selectedOptions: it.selected_options,
            specialInstructions: it.special_instructions,
            userName: `${it?.user_profiles?.first_name || ''} ${it?.user_profiles?.last_name || ''}`.trim(),
            menuItemId: it.menu_items?.id,
          })) || [];

        broadcastHeaderCart({
          items: sharedItems,
          restaurantInfo: data?.restaurants || null,
          cartId: item.cartId,
        });

        return; // done
      } catch (e) {
        console.error('Failed to save cart item edits:', e);
        return;
      }
    }

    // --- EDITING A LOCAL (non-shared) CART ROW ---
    if (isEditing && !item?.cartId) {
      setCartItems((prev) => {
        const next = prev.map((it) =>
          (it.rowId === item.cartRowId ? { ...it, ...item, quantity, rowId: item.cartRowId } : it)
        );

        broadcastHeaderCart({
          items: next,
          restaurantInfo: restaurant,
          cartId: null,
        });

        return next;
      });
      return;
    }

    // --- ADD FLOW (local) ---
    setCartItems((prev) => {
      const rowId = makeRowId();
      const next = [
        ...prev,
        {
          ...item,
          quantity,
          rowId,
          // keep the original menu item id explicitly for editing later
          menuItemId: item.id,
        },
      ];

      broadcastHeaderCart({
        items: next,
        restaurantInfo: restaurant,
        cartId: null,
      });

      return next;
    });
  };

  const handleBackClick = () => navigate('/home-restaurant-discovery');

  // Map DB restaurant to your hero/info expectations
  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image_url || '',
      cuisine: restaurant.cuisine_type || restaurant.cuisine || '',
      rating: restaurant.rating || undefined,
      distance: restaurant.distance ?? undefined,
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      priceRange: undefined,
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone_number || '',
      address: restaurant.address || '',
      coordinates: restaurant.coords || undefined,
      deliveryRadius: undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [],
      ratingBreakdown: [],
      reviews: [],
    };
  }, [restaurant]);

  const handleFulfillmentChange = (next) => {
    setFulfillment(next);
    if (next.service !== selectedService) setSelectedService(next.service);
    window.dispatchEvent(
      new CustomEvent('deliveryAddressUpdate', {
        detail: { address: next.address, lat: next.coords ?? null },
      })
    );
  };

  // Handle "Remove" from header drawer while on this page (LOCAL cart only)
  useEffect(() => {
    const onRemove = (e) => {
      const { itemId } = e?.detail || {};
      if (!itemId) return;

      setCartItems((prev) => {
        const next = prev.filter((it) => (it.rowId || it.id) !== itemId);

        broadcastHeaderCart({
          items: next,
          restaurantInfo: restaurant,
          cartId: null,
        });

        return next;
      });
    };
    window.addEventListener('cartItemRemove', onRemove);
    return () => window.removeEventListener('cartItemRemove', onRemove);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant]);

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
  }, [location.state?.editItem, menuRaw]);

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
            />

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
                  const category = menuCategories.find((c) => c.id === categoryId);
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