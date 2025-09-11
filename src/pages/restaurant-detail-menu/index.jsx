import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Header from '../../components/ui/Header';
import FulfillmentBar from '../../components/ui/FulfillmentBar';
import CartSummaryFloat from '../../components/ui/CartSummaryFloat';
import RestaurantHero from './components/RestaurantHero';
import MenuCategoryNav from './components/MenuCategoryNav';
import MenuSearch from './components/MenuSearch';
import MenuSection from './components/MenuSection';
import ItemCustomizationModal from './components/ItemCustomizationModal';
import RestaurantInfo from './components/RestaurantInfo';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

// helpers
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

function slugifyId(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const RestaurantDetailMenu = () => {
  const navigate = useNavigate();
  const { restaurantId } = useParams(); // support /restaurant/:restaurantId
  const location = useLocation();

  const [fulfillment, setFulfillment] = useState(() => {
    const fromState = location.state?.fulfillment;
    return {
      service: fromState?.service ?? 'delivery',
      address: fromState?.address ?? '',
      coords: fromState?.coords ?? null,
      date: fromState?.date ?? toDateInput(new Date()),
      time: fromState?.time ?? '12:00',
    };
  });
  const [selectedService, setSelectedService] = useState(
    location.state?.fulfillment?.service ?? 'delivery'
  );
  const [activeCategory, setActiveCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [showRestaurantInfo, setShowRestaurantInfo] = useState(false);

  // fetched data
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [menuRaw, setMenuRaw] = useState([]); // flat rows from menu_items
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const svc = qs.get('service');
    const address = qs.get('delivery_address') || qs.get('pickup_address') || qs.get('address') || '';
    const whenISO = qs.get('whenISO');
    const date = qs.get('date');
    const time = qs.get('time');
    const lat = qs.get('lat');
    const lng = qs.get('lng');

    setFulfillment((prev) => {
      const next = {
        ...prev,
        service: (svc === 'delivery' || svc === 'pickup') ? svc : prev.service,
        address: address || prev.address,
        coords: (lat && lng) ? { lat: +lat, lng: +lng } : prev.coords,
        date: date || (whenISO ? toDateInput(new Date(whenISO)) : prev.date),
        time: time || (whenISO ? toTimeInput(new Date(whenISO)) : prev.time),
      };
      return next;
    });

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
          setRestaurant(rest);
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
        category: row.category || 'Menu',
        // You can extend mapping as needed (spicyLevel, sizes, toppings, etc.)
      });
    }

    // Build arrays
    const cats = Array.from(groups.values()).map(g => ({
      id: g.id,
      name: g.name,
      itemCount: g.items.length,
      description: '', // optional subtitle if you want one
    }));

    // Ensure deterministic order
    cats.sort((a, b) => a.name.localeCompare(b.name));

    // Default active tab to first category
    if (!activeCategory && cats[0]?.id) {
      // NOTE: we can't set state here; we handle it below in effect.
    }

    // Map to the object shape used by existing code { [categoryId]: items[] }
    const itemsByCat = {};
    for (const g of cats) {
      itemsByCat[g.id] = groups.get(g.id).items;
    }

    return { menuItems: itemsByCat, menuCategories: cats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Scroll spy for category nav
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
  const handleAddToCart = (item, quantity) => {
    setCartItems((prev) => [...prev, { ...item, quantity }]);
  };
  const handleBackClick = () => navigate('/home-restaurant-discovery');

  // Map DB restaurant to your hero/info expectations
  const heroRestaurant = useMemo(() => {
    if (!restaurant) return null;
    return {
      id: restaurant.id,
      name: restaurant.name,
      image: restaurant.image_url || '',
      cuisine: restaurant.cuisine_type || '',
      rating: restaurant.rating || undefined,
      distance: undefined,     // computed elsewhere typically
      deliveryFee: restaurant.delivery_fee ?? undefined,
      minimumOrder: restaurant.minimum_order ?? undefined,
      priceRange: undefined,   // not in schema
      isOpen: restaurant.is_available ?? true,
      phone: restaurant.phone_number || '',
      address: restaurant.address || '',
      coordinates: restaurant.coords || undefined,
      deliveryRadius: undefined,
      offers: [],
      features: [restaurant.supports_catering ? 'Catering' : null].filter(Boolean),
      hours: [],               // not modeled in mock; component should handle empty
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
          {/* Desktop Sidebar */}
          {/* <div className="hidden md:block w-80 flex-shrink-0">
            <MenuCategoryNav
              categories={menuCategories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              isSticky={true}
            />
          </div> */}

          {/* Main */}
          <div className="flex-1">
            <RestaurantHero
              restaurant={heroRestaurant}
              selectedService={selectedService}
              onServiceToggle={handleServiceToggle}
            />

            {/* Mobile Category Navigation */}
            {/* <MenuCategoryNav
              categories={menuCategories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
              isSticky={true}
            /> */}

            <MenuSearch
              searchQuery={searchQuery}
              onSearch={handleSearch}
              onClearSearch={handleClearSearch}
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

        {/* Floating Cart Summary */}
        {/* <CartSummaryFloat isVisible={cartItems.length > 0} /> */}

        {/* Item Customization Modal */}
        <ItemCustomizationModal
          item={selectedItem}
          isOpen={isCustomizationModalOpen}
          onClose={() => {
            setIsCustomizationModalOpen(false);
            setSelectedItem(null);
          }}
          onAddToCart={handleAddToCart}
        />
    </main>
    </div>
  );
};

export default RestaurantDetailMenu;
