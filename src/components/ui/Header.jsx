import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts';
import Icon from '../AppIcon';
import Button from './Button';
import mealLogo from '../images/meal.png';
import cartDbService from '../../services/cartDBService';

const Header = ({ notifications = 0, className = '' }) => {
  const { user, userProfile, teams, activeTeam, loadingTeams, switchActiveTeam, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const teamMenuRef = useRef(null);

  const isInlineCartRoute = /\/restaurant\/|\/shopping-cart-checkout/.test(location.pathname);

  // cart badge + drawer
  const [cartBadge, setCartBadge] = useState({ count: 0, total: 0, name: 'Cart', cartId: null });
  const [cartPanel, setCartPanel] = useState({ restaurant: null, items: [], fulfillment: null });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartHubOpen, setIsCartHubOpen] = useState(false);
  const [hubLoading, setHubLoading] = useState(false);
  const [hubErr, setHubErr] = useState('');
  const [hubCarts, setHubCarts] = useState([]); // list of draft carts
  const [viewCartSnapshot, setViewCartSnapshot] = useState(null); // for "View" modal

  

  // Close the team menu when clicking outside of it
  useEffect(() => {
    const onClickAway = (e) => {
      if (!teamMenuRef.current) return;
      if (!teamMenuRef.current.contains(e.target)) setShowTeamMenu(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const handleRemoveFromDrawer = (it) => {
    // Broadcast so whichever page is active can perform the real remove (shared/local)
    window.dispatchEvent(
      new CustomEvent('cartItemRemove', {
        detail: { cartId: cartBadge.cartId || null, itemId: it.id, menuItemId: it.menuItemId ?? null },
      })
    );
  };

  const handleEditFromDrawer = (it) => {
    setIsCartOpen(false);
    const rid = cartPanel.restaurant?.id || it.restaurantId || null;
    if (!rid) {
      // Fallback so you don’t land on 404
      navigate('/home-restaurant-discovery');
      return;
    }
    navigate(`/restaurant/${rid}`, {
      state: {
        cartId: cartBadge.cartId || null,
        restaurant: cartPanel.restaurant || null,
        editItem: {
          ...it,
          // ensure menu item id is present so the menu page can resolve the item
          menuItemId: it.menuItemId ?? it.id,
        },
      },
    });
  };

  const formatDateTime = (c) => {
    const d = c?.fulfillment?.date;
    const t = c?.fulfillment?.time;
    if (!d && !t) return null;
    return [d, t].filter(Boolean).join(' • ');
  };

  const handleHubView = async (cart) => {
    try {
      const snap = await cartDbService.getCartSnapshot(cart.id);
      setViewCartSnapshot(snap); // opens the “View Items” modal
    } catch (e) {
      alert(e?.message || 'Failed to open cart.');
    }
  };

  const handleHubEdit = (cart) => {
    setIsCartHubOpen(false);
    const rid = cart.restaurant?.id;
    if (!rid) {
      navigate('/home-restaurant-discovery');
      return;
    }
    navigate(`/restaurant/${rid}`, {
      state: {
        cartId: cart.id,
        restaurant: cart.restaurant,
        fulfillment: cart.fulfillment || null,
      },
    });
  };

  const handleHubDelete = async (cart) => {
    const ok = window.confirm('Delete this cart and all its items? This cannot be undone.');
    if (!ok) return;
    try {
      await cartDbService.deleteCart(cart.id);
      setHubCarts((prev) => prev.filter((c) => c.id !== cart.id));
      // Clear header badge if it belonged to the currently tracked cart
      if (cartBadge.cartId === cart.id) {
        setCartBadge({ count: 0, total: 0, name: 'Cart', cartId: null });
        setCartPanel({ restaurant: null, items: [], fulfillment: null });
      }
    } catch (e) {
      alert(e?.message || 'Failed to delete cart.');
    }
  };


  const formatCustomizations = (item) => {
    const lines = [];
    // “legacy” customizations array: [{name, price}]
    if (Array.isArray(item?.customizations) && item.customizations.length) {
      lines.push(...item.customizations.map((c) => c?.name || String(c)));
    }
    // special instructions
    if (item?.specialInstructions) {
      lines.push(`Notes: ${item.specialInstructions}`);
    }
    // selectedOptions may be:
    //  • object: { groupId: [optId, ...] } (local flow)
    //  • array of {name,...} or strings (shared-cart)
    const so = item?.selectedOptions;
    if (!so) return lines;

    // array of names/objects
    if (Array.isArray(so)) {
      lines.push(
        ...so
          .map((o) => (typeof o === 'string' ? o : o?.name))
          .filter(Boolean)
      );
      return lines;
    }
    // object mapping group -> values (ids or names)
    if (typeof so === 'object') {
      Object.values(so).forEach((arr) => {
        const vals = Array.isArray(arr) ? arr : [arr];
        vals.forEach((v) => {
          // if options with ids exist on the item, try to resolve id -> name
          if (item?.options && typeof v === 'string') {
            try {
              const groups = Array.isArray(item.options)
                ? item.options
                : Object.entries(item.options || {}).map(([k, opts]) => ({ id: k, options: opts }));
              let found;
              for (const g of groups) {
                const opts = Array.isArray(g?.options) ? g.options : [];
                found = opts.find((o) => o?.id === v || o?.name === v);
                if (found) break;
              }
              lines.push(found?.name || String(v));
            } catch {
              lines.push(String(v));
            }
          } else {
            lines.push(typeof v === 'string' ? v : v?.name);
          }
        });
      });
    }
    return lines.filter(Boolean);
  };

  // listen for global cart events
  useEffect(() => {
    const onBadge = (e) => {
      if (!e?.detail) return;
      const { restaurant, items, fulfillment, ...rest } = e.detail;
      setCartBadge((prev) => ({ ...prev, ...rest }));
      if (restaurant || items || fulfillment) {
        setCartPanel((p) => ({
          restaurant: restaurant ?? p.restaurant,
          items: Array.isArray(items) ? items : p.items,
          fulfillment: fulfillment ?? p.fulfillment,
        }));
      }
    };
    const onOpen = () => setIsCartOpen(true);
    const onClose = () => setIsCartOpen(false);
    window.addEventListener('cartBadge', onBadge);
    window.addEventListener('openCartDrawer', onOpen);
    window.addEventListener('closeCartDrawer', onClose);
    return () => {
      window.removeEventListener('cartBadge', onBadge);
      window.removeEventListener('openCartDrawer', onOpen);
      window.removeEventListener('closeCartDrawer', onClose);
    };
  }, []);

  // Fetch hub carts any time the hub opens
  useEffect(() => {
    if (!isCartHubOpen || !activeTeam?.id) return;
    let cancelled = false;
    (async () => {
      setHubLoading(true);
      setHubErr('');
      try {
        const list = await cartDbService.listOpenCarts(activeTeam.id);
        if (!cancelled) setHubCarts(list);
      } catch (e) {
        if (!cancelled) setHubErr(e?.message || 'Failed to load carts');
      } finally {
        if (!cancelled) setHubLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isCartHubOpen, activeTeam?.id]);

  const navigationItems = [
    { label: 'Dashboard', path: '/dashboard-home', icon: 'LayoutDashboard', tooltip: 'Team meal overview and quick actions' },
    { label: 'Calendar', path: '/calendar-order-scheduling', icon: 'Calendar', tooltip: 'Schedule and manage meal orders' },
    { label: 'Orders', path: '/order-history-management', icon: 'ClipboardList', tooltip: 'View and manage order history' },
    { label: 'Team', path: '/team-members-management', icon: 'Users', tooltip: 'Manage team members and roles' },
  ];

  const handleNavigation = (path) => {
    if (path === '/team-members-management' && teams.length === 0 && !loadingTeams) {
      navigate('/team-setup', { state: { next: '/team-members-management', source: 'header' } });
      setIsMobileMenuOpen(false);
      return;
    }
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleUserMenuToggle = () => setIsUserMenuOpen(!isUserMenuOpen);

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    signOut();
    navigate('/login-registration');
  };

  const isActivePath = (path) =>
    location?.pathname === path || (location?.pathname === '/' && path === '/dashboard-home');

  const fullName =
    userProfile?.first_name || userProfile?.last_name
      ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim()
      : '';

  const initials = fullName
    .split(' ')
    .map((name) => name.charAt(0))
    .join('')
    .toUpperCase();

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-athletic ${className}`}>
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo and Team Info */}
        <div className="flex items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <img src={mealLogo} alt="MealOps Logo" className="h-12 w-auto object-contain" />
            </Link>

            {/* Team Info Display */}
            {!loadingTeams && activeTeam && (
              <>
                <div className="h-10 border-l border-border" />
                <div className="relative w-20" ref={teamMenuRef}>
                  <button
                    onClick={() => setShowTeamMenu((s) => !s)}
                    className="flex items-center space-x-2 h-10 px-1 py-2 rounded-md hover:bg-muted transition-athletic"
                    aria-haspopup="menu"
                    aria-expanded={showTeamMenu}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-md font-bold text-foreground">{activeTeam.name}</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground font-medium uppercase">
                          {activeTeam.gender}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium uppercase">
                          {activeTeam.sport}
                        </span>
                      </div>
                    </div>
                    {!loadingTeams && teams.length > 1 && (
                      <Icon
                        name={showTeamMenu ? 'ChevronUp' : 'ChevronDown'}
                        size={16}
                        className="ml-2 text-muted-foreground"
                      />
                    )}
                  </button>

                  {/* Dropdown Menu - only show if there are multiple teams */}
                  {showTeamMenu && teams.length > 1 && (
                    <div className="absolute left-0 mt-2 w-56 bg-popover border border-border rounded-md shadow-lg z-20 max-h-64 overflow-auto">
                      {teams.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            switchActiveTeam(t.id);
                            setShowTeamMenu(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm transition-athletic flex items-center justify-between
                            ${t.id === activeTeam?.id ? 'bg-muted text-foreground font-semibold' : 'hover:bg-muted text-muted-foreground'}
                          `}
                        >
                          <div className="flex flex-col items-start">
                            <span className="font-semibold">{t.name}</span>
                            <div className="flex items-center space-x-1">
                              <span className="text-xs text-muted-foreground uppercase">{t.gender}</span>
                              <span className="text-xs text-muted-foreground uppercase">{t.sport}</span>
                            </div>
                          </div>
                          {t.id === activeTeam?.id && <Icon name="Check" size={16} className="ml-2 text-primary" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center space-x-1">
          {navigationItems?.map((item) => (
            <button
              key={item?.path}
              onClick={() => handleNavigation(item?.path)}
              className={`
                flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-athletic
                ${isActivePath(item?.path)
                  ? 'bg-primary text-primary-foreground shadow-athletic'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }
              `}
              title={item?.tooltip}
            >
              <Icon name={item?.icon} size={16} />
              <span>{item?.label}</span>
              {item?.path === '/meal-polling-system' && notifications > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-accent text-accent-foreground rounded-full">
                  {notifications}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-3">
          {/* Cart button (global) */}
          <button
            className="relative p-2 text-muted-foreground hover:text-foreground transition-athletic"
            onClick={() => {
              if (isInlineCartRoute) setIsCartOpen(true);
              else {
                setIsCartHubOpen(true);
              }
            }}
            aria-label={`Open cart${cartBadge.count ? ` (${cartBadge.count})` : ''}`}
            title="Cart"
          >
            <Icon name="ShoppingCart" size={20} className="-scale-x-100" />
            {isInlineCartRoute && cartBadge.count > 0 && (
              <span className="absolute -top-1 -left-1 min-w-[20px] h-5 px-1 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                {cartBadge.count > 99 ? '99+' : cartBadge.count}
              </span>
            )}
          </button>

          {/* Notifications */}
          <button className="relative p-2 text-muted-foreground hover:text-foreground transition-athletic">
            <Icon name="Bell" size={20} />
            {notifications > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent text-accent-foreground text-xs rounded-full flex items-center justify-center">
                {notifications > 9 ? '9+' : notifications}
              </span>
            )}
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen((s) => !s)}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted transition-athletic"
            >
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                {userProfile?.first_name ? (
                  <span className="text-white font-bold text-xs">{initials}</span>
                ) : (
                  <Icon name="User" size={16} color="white" />
                )}
              </div>
              {fullName && (
                <span className="hidden md:block text-sm font-medium text-foreground">
                  {/* {userProfile?.first_name} */}
                </span>
              )}
              <Icon
                name="ChevronDown"
                size={16}
                className={`text-muted-foreground transition-transform duration-100 ${isUserMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {/* User Dropdown */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-popover border border-border rounded-md shadow-athletic-lg z-50">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{userProfile?.first_name ? `Hi ${userProfile.first_name},` : 'User'}</p>
                    <p className="text-xs text-muted-foreground">{user?.email || 'user@example.com'}</p>
                  </div>
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-athletic flex items-center space-x-2"
                  >
                    <Icon name="User" size={16} />
                    <span>Profile</span>
                  </button>
                  <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-athletic flex items-center space-x-2"
                  >
                    <Icon name="Settings" size={16} />
                    <span>Settings</span>
                  </button>
                  <div className="border-t border-border">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-error hover:bg-muted transition-athletic flex items-center space-x-2"
                    >
                      <Icon name="LogOut" size={16} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-muted-foreground hover:text-foreground transition-athletic"
          >
            <Icon name={isMobileMenuOpen ? 'X' : 'Menu'} size={20} />
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-card border-t border-border shadow-athletic-md">
          <nav className="px-4 py-2 space-y-1">
            {navigationItems?.map((item) => (
              <button
                key={item?.path}
                onClick={() => handleNavigation(item?.path)}
                className={`
                  w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-athletic
                  ${isActivePath(item?.path)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }
                `}
              >
                <Icon name={item?.icon} size={18} />
                <span>{item?.label}</span>
                {item?.path === '/meal-polling-system' && notifications > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-xs bg-accent text-accent-foreground rounded-full">
                    {notifications}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Click outside to close user menu */}
      {isUserMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />}

      {/* Cart Drawer */}
      {isCartOpen &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1200] bg-black/40" onClick={() => setIsCartOpen(false)}>
            <aside
              className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Cart"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="ShoppingCart" size={18} />
                  <span>{cartBadge.name || 'Cart'}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCartOpen(false)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-160px)]">
                <div className="text-sm text-muted-foreground">
                  Items: <span className="font-medium text-foreground">{cartBadge.count}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  Subtotal:{' '}
                  <span className="font-medium text-foreground">${(cartBadge.total || 0).toFixed(2)}</span>
                </div>

                {/* Mini cart list */}
                {cartPanel.items?.length > 0 && (
                  <div className="divide-y divide-border border border-border rounded-md">
                    {cartPanel.items.map((it, idx) => {
                      const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
                      const qty = Number(it?.quantity ?? 1);
                      const lines = formatCustomizations(it);
                      const assignees =
                        Array.isArray(it?.assignedTo) && it.assignedTo.length
                          ? it.assignedTo.map((a) => a?.name).filter(Boolean).join(', ')
                          : it?.userName || null; // shared cart per-user
                      return (
                        <div key={`${it?.id ?? 'row'}-${idx}`} className="p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-foreground truncate">
                                {it?.name || 'Item'}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                x{qty} • ${unit.toFixed(2)}
                              </div>
                              {assignees && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  For: <span className="text-foreground">{assignees}</span>
                                </div>
                              )}
                              {lines?.length > 0 && (
                                <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                                  {lines.map((l, i) => (
                                    <li key={i}>{l}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            {it?.image && (
                              <img src={it.image} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditFromDrawer(it)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveFromDrawer(it)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsCartOpen(false);
                    navigate(
                      `/shopping-cart-checkout${cartBadge.cartId ? `?cartId=${cartBadge.cartId}` : ''}`,
                      {
                        state: {
                          cartId: cartBadge.cartId || null,
                          fulfillment: cartPanel.fulfillment || null,
                          restaurant: cartPanel.restaurant || null,
                        },
                      }
                    );
                  }}
                  disabled={cartBadge.count === 0}
                >
                  View Cart & Checkout
                </Button>
              </div>
            </aside>
          </div>,
          document.body
        )}
      {/* Cart Hub Modal */}
      {isCartHubOpen &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1200] bg-black/40" onClick={() => setIsCartHubOpen(false)}>
            <div
              className="absolute right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Saved Carts"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="ShoppingCart" size={18} />
                  <span>Saved Carts</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsCartHubOpen(false)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>

              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(100vh-64px)]">
                {hubLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
                {hubErr && <div className="text-sm text-destructive">{hubErr}</div>}
                {!hubLoading && !hubErr && hubCarts.length === 0 && (
                  <div className="text-sm text-muted-foreground">No open carts yet.</div>
                )}

                {hubCarts.map((c) => (
                  <div key={c.id} className="border border-border rounded-md overflow-hidden">
                    <div className="p-3 flex items-start gap-3">
                      {c.restaurant?.image && (
                        <img
                          src={c.restaurant.image}
                          alt={c.restaurant?.name}
                          className="h-16 w-16 rounded object-cover shrink-0"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground truncate">
                          {c.restaurant?.name || 'Unknown Restaurant'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.title || 'Cart'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDateTime(c) || 'No date selected'} · {c.providerType || 'provider'} · {c.itemCount} items
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Subtotal: <span className="text-foreground">${c.subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-border p-3 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleHubView(c)}>
                        View
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => handleHubEdit(c)}>
                        Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleHubDelete(c)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body
        )}
      {/* View Items Modal */}
      {viewCartSnapshot &&
        ReactDOM.createPortal(
          <div className="fixed inset-0 z-[1300] bg-black/40" onClick={() => setViewCartSnapshot(null)}>
            <div
              className="absolute inset-0 md:inset-auto md:right-0 md:top-0 md:h-full w-full md:max-w-xl bg-card border-l border-border shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Cart Items"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="font-semibold flex items-center gap-2">
                  <Icon name="UtensilsCrossed" size={18} />
                  <span>{viewCartSnapshot.restaurant?.name || 'Cart Items'}</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setViewCartSnapshot(null)}>
                  <Icon name="X" size={18} />
                </Button>
              </div>

              <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(100vh-64px)]">
                {viewCartSnapshot.items?.map((it, idx) => {
                  const unit = Number(it?.customizedPrice ?? it?.price ?? 0);
                  const qty = Number(it?.quantity ?? 1);
                  const lines = formatCustomizations(it);
                  const assignees =
                    Array.isArray(it?.assignedTo) && it.assignedTo.length
                      ? it.assignedTo.map((a) => a?.name).filter(Boolean).join(', ')
                      : it?.userName || null;
                  return (
                    <div key={`${it?.id ?? 'row'}-${idx}`} className="p-3 border border-border rounded-md">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">{it?.name || 'Item'}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            x{qty} • ${unit.toFixed(2)}
                          </div>
                          {assignees && (
                            <div className="text-xs text-muted-foreground mt-1">
                              For: <span className="text-foreground">{assignees}</span>
                            </div>
                          )}
                          {lines?.length > 0 && (
                            <ul className="mt-1 text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                              {lines.map((l, i) => (
                                <li key={i}>{l}</li>
                              ))}
                            </ul>
                          )}
                          {it?.specialInstructions && (
                            <div className="text-xs text-muted-foreground mt-1">
                              Notes: <span className="text-foreground">{it.specialInstructions}</span>
                            </div>
                          )}
                        </div>
                        {it?.image && (
                          <img src={it.image} alt="" className="h-14 w-14 rounded-md object-cover shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

    </header>
  );
};

export default Header;