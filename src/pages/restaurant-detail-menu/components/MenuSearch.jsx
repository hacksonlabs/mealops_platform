import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/custom/Input';
import Button from '../../../components/ui/custom/Button';

const MenuSearch = ({ onSearch, searchQuery, onClearSearch }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSearch = (value) => {
    onSearch(value);
  };

  const handleClear = () => {
    onSearch('');
    onClearSearch();
    setIsExpanded(false);
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setTimeout(() => {
        document.getElementById('menu-search-input')?.focus();
      }, 100);
    }
  };

  return (
    <div className="bg-card sticky top-[var(--sticky-top,0px)] z-40">
      <div className="p-4">
        {/* Mobile Compact Search */}
        <div className="md:hidden">
          {!isExpanded ? (
            <Button
              variant="outline"
              onClick={toggleExpanded}
              className="w-full justify-start text-muted-foreground"
            >
              <Icon name="Search" size={16} className="mr-2" />
              <span>Search menu items...</span>
            </Button>
          ) : (
            <div className="flex items-center space-x-2">
              <div className="flex-1 relative">
                <Input
                  id="menu-search-input"
                  type="search"
                  placeholder="Search items.."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e?.target?.value)}
                  className="pl-10"
                />
                <Icon 
                  name="Search" 
                  size={16} 
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
              >
                <Icon name="X" size={16} />
              </Button>
            </div>
          )}
        </div>

        {/* Desktop Full Search */}
        <div className="hidden md:block">
          <div className="relative max-w-lg">
            <Input
              type="search"
              placeholder="Search menu items.."
              value={searchQuery}
              onChange={(e) => handleSearch(e?.target?.value)}
              className="w-full pl-10 pr-10"
            />
            <Icon 
              name="Search" 
              size={18} 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 w-8 h-8"
              >
                <Icon name="X" size={14} />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuSearch;