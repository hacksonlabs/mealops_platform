import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const CategoryFilter = ({ onCategoryChange }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', label: 'All', icon: 'Grid3X3' },
    { id: 'pizza', label: 'Pizza', icon: 'Pizza' },
    { id: 'asian', label: 'Asian', icon: 'Utensils' },
    { id: 'mexican', label: 'Mexican', icon: 'Pepper' },
    { id: 'italian', label: 'Italian', icon: 'ChefHat' },
    { id: 'american', label: 'American', icon: 'Beef' },
    { id: 'indian', label: 'Indian', icon: 'Flame' },
    { id: 'chinese', label: 'Chinese', icon: 'Bowl' },
    { id: 'healthy', label: 'Healthy', icon: 'Salad' },
    { id: 'dessert', label: 'Dessert', icon: 'IceCream' },
    { id: 'coffee', label: 'Coffee', icon: 'Coffee' }
  ];

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    onCategoryChange?.(categoryId);
  };

  return (
    <div className="bg-card">
      <div className="px-4 py-4 lg:px-6">
        <div className="flex items-center space-x-3 overflow-x-auto scrollbar-hide">
          {categories?.map((category) => (
            <button
              key={category?.id}
              onClick={() => handleCategorySelect(category?.id)}
              className={`flex-shrink-0 flex flex-col items-center space-y-2 p-3 rounded-lg transition-micro ${
                selectedCategory === category?.id
                  ? 'bg-primary text-primary-foreground shadow-elevation-1'
                  : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                selectedCategory === category?.id 
                  ? 'bg-primary-foreground/20' 
                  : 'bg-background'
              }`}>
                <Icon 
                  name={category?.icon} 
                  size={20} 
                  className={selectedCategory === category?.id ? 'text-primary-foreground' : 'text-current'}
                />
              </div>
              <span className="text-xs font-medium whitespace-nowrap">
                {category?.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryFilter;