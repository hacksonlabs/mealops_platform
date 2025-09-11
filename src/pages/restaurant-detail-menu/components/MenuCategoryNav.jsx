import React, { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';

const MenuCategoryNav = ({ categories, activeCategory, onCategoryChange, isSticky = false }) => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollPosition(window.scrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToCategory = (categoryId) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const headerHeight = 64; // Header height
      const navHeight = 60; // Category nav height
      const offset = headerHeight + navHeight + 16; // Extra padding
      
      const elementPosition = element?.getBoundingClientRect()?.top + window.pageYOffset;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    onCategoryChange(categoryId);
  };

  return (
    <>
      {/* Mobile Horizontal Scroll */}
      <div className={`md:hidden bg-card border-b border-border ${
        isSticky ? 'sticky top-16 z-40 shadow-elevation-1' : ''
      }`}>
        <div className="flex overflow-x-auto scrollbar-hide px-4 py-3 space-x-2">
          {categories?.map((category) => (
            <Button
              key={category?.id}
              variant={activeCategory === category?.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => scrollToCategory(category?.id)}
              className="whitespace-nowrap flex-shrink-0"
            >
              {category?.name}
              <span className="ml-2 text-xs opacity-75">
                ({category?.itemCount})
              </span>
            </Button>
          ))}
        </div>
      </div>
      {/* Desktop Vertical Sidebar */}
      <div className="hidden md:block">
        <div className={`bg-card border-r border-border ${
          isSticky ? 'sticky top-28 h-[calc(100vh-7rem)] overflow-y-auto' : ''
        }`}>
          <div className="p-4">
            <h3 className="text-lg font-semibold text-foreground mb-4">Menu Categories</h3>
            <div className="space-y-2">
              {categories?.map((category) => (
                <Button
                  key={category?.id}
                  variant={activeCategory === category?.id ? 'default' : 'ghost'}
                  onClick={() => scrollToCategory(category?.id)}
                  className="w-full justify-start text-left"
                >
                  <div className="flex items-center justify-between w-full">
                    <span>{category?.name}</span>
                    <span className="text-xs opacity-75">
                      {category?.itemCount}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MenuCategoryNav;