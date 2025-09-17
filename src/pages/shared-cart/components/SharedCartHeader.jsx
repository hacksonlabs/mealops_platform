import React from 'react';
import Icon from '@/components/AppIcon';
import Button from '@/components/ui/custom/Button';

export default function SharedCartHeader({ teamLine, onOpenCart }) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-40
                 bg-white dark:bg-white border-b border-border shadow-sm"
    >
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logo.svg"
            alt="Company Logo"
            className="h-6 w-auto"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="hidden sm:inline text-sm font-medium text-muted-foreground">|</span>
          <div className="text-sm font-medium text-foreground truncate">{teamLine}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open cart"
          onClick={onOpenCart}
          title="Open cart"
        >
          <Icon name="ShoppingCart" size={20} />
        </Button>
      </div>
    </header>
  );
}
