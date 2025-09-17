// src/pages/shared-cart/components/SharedCartHeader.jsx

import React from 'react';
import { Link } from 'react-router-dom';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/custom/Button';
import mealLogo from '@/components/images/meal.png';
import { useAuth } from '@/contexts';

export default function SharedCartHeader({ onOpenCart, className = '' }) {
  const { loadingTeams, activeTeam } = useAuth();

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-athletic ${className}`}>
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Logo + Team Info */}
        <div className="flex items-center">
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <img
                src={mealLogo}
                alt="MealOps Logo"
                className="h-12 w-auto object-contain"
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
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open cart"
          title="Open cart"
          onClick={onOpenCart}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon name="ShoppingCart" size={20} className="-scale-x-100" />
        </Button>
      </div>
    </header>
  );
}
