// src/hooks/restaurant-details/useMenuFiltering.js
import { useEffect, useMemo, useState } from 'react';

export default function useMenuFiltering({ providerItemsByCat, providerCategories }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  // initial category
  useEffect(() => {
    if (!activeCategory && providerCategories?.length) {
      setActiveCategory(providerCategories[0].id);
    }
  }, [providerCategories, activeCategory]);

  const filteredMenuItems = useMemo(() => {
    if (!searchQuery) return providerItemsByCat;
    const q = searchQuery.toLowerCase();
    const filtered = {};
    Object.keys(providerItemsByCat || {}).forEach((cid) => {
      const items = (providerItemsByCat[cid] || []).filter(
        (item) =>
          item?.name?.toLowerCase()?.includes(q) ||
          item?.description?.toLowerCase()?.includes(q)
      );
      if (items.length) filtered[cid] = items;
    });
    return filtered;
  }, [providerItemsByCat, searchQuery]);

  // scroll spy
  useEffect(() => {
    const handleScroll = () => {
      const categories = Object.keys(filteredMenuItems || {});
      const scrollPosition = window.scrollY + 200;
      for (let i = categories.length - 1; i >= 0; i--) {
        const el = document.getElementById(`category-${categories[i]}`);
        if (el && el.offsetTop <= scrollPosition) {
          setActiveCategory(categories[i]);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [filteredMenuItems]);

  return { searchQuery, setSearchQuery, filteredMenuItems, activeCategory, setActiveCategory };
}