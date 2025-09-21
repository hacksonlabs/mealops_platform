// src/pages/shared-cart/components/SharedCartHeader.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/custom/Button';
import mealLogo from '@/components/images/meal.png';
import { useAuth } from '@/contexts';

export default function SharedCartHeader({
  onOpenCart,
  className = '',
  badgeCount = 0,
  verifiedIdentity,
}) {
  const { loadingTeams, activeTeam } = useAuth();
  const displayName =
    (verifiedIdentity?.fullName || '').trim() ||
    (verifiedIdentity?.email ? verifiedIdentity.email.split('@')[0] : '');
  const firstName = displayName.split(/\s+/)[0] || null;

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-athletic ${className}`}>
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo + Team Info */}
        <div className="flex items-center">
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <img
                src={mealLogo}
                alt="MealOps Logo"
                className="h-8 md:h-12 w-auto object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </Link>

            {/* Team Info Display */}
            {!loadingTeams && activeTeam && (
              <>
                <div className="h-10 border-l border-border" />
                <div className="relative">
                  <div
                    className="flex items-center space-x-2 h-10 px-1 py-2 rounded-md"
                    aria-haspopup="menu"
                    aria-expanded="false"
                  >
                    <div className="flex flex-col items-center text-center">
                      <span className="text-sm md:text-md font-bold text-foreground">
                        {activeTeam.name}
                      </span>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">
                          {activeTeam.gender}
                        </span>
                        <span className="text-[10px] md:text-xs text-muted-foreground font-medium uppercase">
                          {activeTeam.sport}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {firstName && (
              <>
                <div className="h-10 border-l border-border" />
                <div className="text-xs md:text-sm text-muted-foreground">
                  Hi, <span className="font-semibold text-foreground">{firstName}</span> 👋
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <button
          onClick={onOpenCart}
          className="relative inline-flex items-center justify-center"
          aria-label="Open cart"
        >
          <Icon name="ShoppingCart" size={20} className="-scale-x-100" />
          {!!badgeCount && (
            <span className="absolute -top-2 -left-2 min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-[16px] text-center">
              {badgeCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
