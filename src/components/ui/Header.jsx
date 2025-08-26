import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts';
import Icon from '../AppIcon';
import Button from './Button';
import mealLogo from '../images/meal.png';

const Header = ({ notifications = 0, className = '' }) => {
  const { user, userProfile, teams, activeTeam, loadingTeams, switchActiveTeam, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const teamMenuRef = useRef(null);


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
    { 
      label: 'Dashboard', 
      path: '/dashboard-home', 
      icon: 'LayoutDashboard',
      tooltip: 'Team meal overview and quick actions'
    },
    { 
      label: 'Calendar', 
      path: '/calendar-order-scheduling',
      icon: 'Calendar',
      tooltip: 'Schedule and manage meal orders'
    },
    // { 
    //   label: 'Polling', 
    //   path: '/meal-polling-system', 
    //   icon: 'Vote',
    //   tooltip: 'Create and manage meal polls'
    // },
    { 
      label: 'Orders', 
      path: '/order-history-management', 
      icon: 'ClipboardList',
      tooltip: 'View and manage order history'
    },
    // { 
    //   label: 'Reports', 
    //   path: '/expense-reports-analytics', 
    //   icon: 'BarChart3',
    //   tooltip: 'Financial analytics and expense reports'
    // },
    { 
      label: 'Team', 
      path: '/team-members-management', 
      icon: 'Users',
      tooltip: 'Manage team members and roles'
    },
    // { 
    //   label: 'Locations', 
    //   path: '/saved-addresses-locations', 
    //   icon: 'MapPin',
    //   tooltip: 'Saved addresses and restaurant partners'
    // },
    // { 
    //   label: 'Billing', 
    //   path: '/payment-methods-billing', 
    //   icon: 'CreditCard',
    //   tooltip: 'Payment methods and billing management'
    // }
  ];

  // const handleNavigation = (path) => {
  //   navigate(path);
  //   setIsMobileMenuOpen(false);
  // };

  const handleNavigation = (path) => {
    if (path === '/team-members-management' && teams.length === 0 && !loadingTeams) {
      navigate('/team-setup', { state: { next: '/team-members-management', source: 'header' } });
      setIsMobileMenuOpen(false);
      return;
    }
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const handleUserMenuToggle = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  const handleLogout = () => {
    setIsUserMenuOpen(false);
    signOut();
    navigate('/login-registration')
  };

  const isActivePath = (path) => {
    return location?.pathname === path || (location?.pathname === '/' && path === '/dashboard-home');
  };

  const fullName = userProfile?.first_name || userProfile?.last_name 
    ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() 
    : '';

  const initials = fullName
    .split(' ')
    .map(name => name.charAt(0))
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
                <div className='h-10 border-l border-border' />
                <div className="relative w-20" ref={teamMenuRef}>
                  <button
                    onClick={() => setShowTeamMenu((s) => !s)}
                    className="flex items-center space-x-2 h-10 px-1 py-2 rounded-md hover:bg-muted transition-athletic"
                    aria-haspopup="menu"
                    aria-expanded={showTeamMenu}
                  >
                    <div className="flex flex-col items-center">
                      <span className="text-md font-bold text-foreground">
                        {activeTeam.name}
                      </span>
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
                      <Icon name={showTeamMenu ? 'ChevronUp' : 'ChevronDown'} size={16} className="ml-2 text-muted-foreground" />
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
              onClick={handleUserMenuToggle}
              className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted transition-athletic"
            >
              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
                {/* Conditionally render initials or generic icon */}
                {userProfile?.first_name ? (
                  <span className="text-white font-bold text-xs">
                    {initials}
                  </span>
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
                    <p className="text-sm font-medium text-foreground">
                      {'Hi ' + userProfile?.first_name + ',' || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.email || 'user@example.com'}
                    </p>
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
            <Icon name={isMobileMenuOpen ? "X" : "Menu"} size={20} />
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
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;