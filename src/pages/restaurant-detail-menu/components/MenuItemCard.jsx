import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Image from '../../../components/AppImage';
import Button from '../../../components/ui/custom/Button';

const MenuItemCard = ({ item, onAddToCart, onItemClick }) => {
  const [quantity, setQuantity] = useState(0);

  const addOne = () => {
    if (item?.hasCustomizations) {
      onItemClick?.(item);
      return;
    }
    setQuantity((q) => q + 1);
    onAddToCart?.(item, 1);
  };

  const changeQty = (next) => {
    if (next < 0) return;
    const delta = next - quantity;
    setQuantity(next);
    if (delta !== 0) onAddToCart?.(item, delta);
  };

  const price = typeof item?.price === 'number' ? item.price.toFixed(2) : '—';

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-elevation-1 transition-micro">
      {/* Image */}
      <div className="relative">
        <Image
          src={item?.image}
          alt={item?.name}
          className="w-full aspect-[4/3] object-cover"
        />

        {/* Add */}
        <button
          type="button"
          onClick={() => onItemClick?.(item)}
          className="absolute bottom-2 right-2 h-9 w-9 rounded-full bg-background/90 border border-border flex items-center justify-center shadow-elevation-1 hover:bg-background"
          aria-label="Customize & add"
        >
          <Icon name="Plus" size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm md:text-base font-semibold text-foreground tracking-tight line-clamp-1">
          {item?.name}
        </h3>

        {item?.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm md:text-base font-bold text-foreground font-mono">
            ${price}
          </span>

          {/* <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item?.calories && <span>{item.calories} cal</span>}
            {item?.hasCustomizations && (
              <span className="inline-flex items-center gap-1">
                <Icon name="Settings" size={12} />
                Customizable
              </span>
            )}
          </div> */}
        </div>
      </div>
    </div>
  );
};

export default MenuItemCard;
