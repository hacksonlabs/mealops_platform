import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts';
import Icon from '../AppIcon';
import mealLogo from '../images/meal.png';
import { useCartBadge } from '@/hooks/cart';
import CartOverlays from './cart/CartOverlays';

const Header = ({ className = '' }) => {
  const { user, userProfile, teams, activeTeam, loadingTeams, switchActiveTeam, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const teamMenuRef = useRef(null);

  const isInlineCartRoute = /\/restaurant\/|\/shopping-cart-checkout/.test(location.pathname);
  const cartBadge = useCartBadge();


  // Close the team menu when clicking outside of it
  useEffect(() => {
    const onClickAway = (e) => {
      if (!teamMenuRef.current) return;
      if (!teamMenuRef.current.contains(e.target)) setShowTeamMenu(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

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
      <div className="flex items-center justify-between h-14 px-3 sm:px-4 lg:h-16 lg:px-6">
        {/* Logo and Team Info */}
        <div className="flex items-center">
          <div className="flex items-center space-x-3 lg:space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <img src={mealLogo} alt="MealOps Logo" className="h-10 w-auto object-contain sm:h-11 lg:h-12" />
            </Link>

            {/* Team Info Display */}
            {!loadingTeams && activeTeam && (
              <>
                <div className="h-8 border-l border-border sm:h-10" />
                <div className="relative min-w-[72px]" ref={teamMenuRef}>
                  <button
                    onClick={() => setShowTeamMenu((s) => !s)}
                    className="flex items-center gap-1 sm:gap-2 h-8 sm:h-10 px-1.5 py-1 sm:px-1 sm:py-2 rounded-md hover:bg-muted transition-athletic"
                    aria-haspopup="menu"
                    aria-expanded={showTeamMenu}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-sm sm:text-base font-bold text-foreground leading-tight">
                        {activeTeam.name}
                      </span>
                      <div className="flex items-center space-x-1 sm:space-x-2">
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase">
                          {activeTeam.gender}
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase">
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
            </button>
          ))}
        </nav>

        {/* Right Side Actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Cart button (global) */}
          <button
            className="relative p-2 text-muted-foreground hover:text-foreground transition-athletic"
            onClick={() => {
              if (isInlineCartRoute) window.dispatchEvent(new Event('openCartDrawer'));
              else {
                window.dispatchEvent(new Event('openCartHub'));
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

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen((s) => !s)}
              className="hidden lg:flex items-center space-x-2 p-2 rounded-md hover:bg-muted transition-athletic"
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
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-athletic flex items-center space-x-2"
                  >
                    <Icon name="User" size={16} />
                    <span>Profile</span>
                  </button>
                  {/* <button
                    onClick={() => setIsUserMenuOpen(false)}
                    className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-athletic flex items-center space-x-2"
                  >
                    <Icon name="Settings" size={16} />
                    <span>Settings</span>
                  </button> */}
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
          <div className="px-4 py-3 flex items-center gap-3 border-b border-border">
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center">
              {userProfile?.first_name ? (
                <span className="text-white font-semibold text-xs">{initials}</span>
              ) : (
                <Icon name="User" size={16} color="white" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {fullName || 'Account'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
            <button
              onClick={() => {
                setIsUserMenuOpen(false);
                handleNavigation('/profile');
              }}
              className="p-2 text-muted-foreground hover:text-foreground transition-athletic"
              aria-label="Go to profile"
            >
              <Icon name="User" size={18} />
            </button>
          </div>
          <nav className="px-3 py-2 space-y-1">
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
              </button>
            ))}
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium text-error hover:bg-muted transition-athletic"
            >
              <Icon name="LogOut" size={18} />
              <span>Sign out</span>
            </button>
          </nav>
        </div>
      )}

      {/* Click outside to close user menu */}
      {isUserMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />}

      <CartOverlays />

    </header>
  );
};

export default Header;
