import React from 'react';
import MenuItemCard from './MenuItemCard';

const MenuSection = ({ category, items, onAddToCart, onItemClick }) => {
  return (
    <div id={`category-${category?.id}`} className="mb-8">
      <div className="sticky top-[calc(var(--sticky-top,0px)+var(--search-h,0px))]
             bg-background/95 backdrop-blur-sm z-30 py-3 md:py-4 border-b border-border mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {category?.name}
            </h2>
            {category?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {category?.description}
              </p>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {items?.length} {items?.length === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
        {items?.map((item) => (
          <MenuItemCard
            key={item?.id}
            item={item}
            onAddToCart={onAddToCart}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
};

export default MenuSection;
