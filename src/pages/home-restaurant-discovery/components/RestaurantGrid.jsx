import React, { useState, useEffect } from 'react';
import RestaurantCard from './RestaurantCard';
import Icon from '../../../components/AppIcon';

const RestaurantGrid = ({ selectedCategory, selectedService, appliedFilters, searchQuery }) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  // Mock restaurant data
  const mockRestaurants = [
    {
      id: 1,
      name: "Tony\'s Pizzeria",
      image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
      cuisine: "Italian",
      description: "Authentic wood-fired pizza and Italian classics",
      rating: 4.8,
      reviewCount: 324,
      deliveryTime: "25-35 min",
      distance: "0.8 mi",
      deliveryFee: "2.99",
      status: "open",
      promotion: "20% OFF",
      isFavorite: false,
      priceRange: "$$",
      features: ["free-delivery", "pickup-available"]
    },
    {
      id: 2,
      name: "Dragon Palace",
      image: "https://images.unsplash.com/photo-1563379091339-03246963d51a?w=400&h=300&fit=crop",
      cuisine: "Chinese",
      description: "Traditional Chinese dishes with modern flair",
      rating: 4.6,
      reviewCount: 198,
      deliveryTime: "30-40 min",
      distance: "1.2 mi",
      deliveryFee: "3.49",
      status: "open",
      promotion: null,
      isFavorite: true,
      priceRange: "$$",
      features: ["pickup-available", "group-ordering"]
    },
    {
      id: 3,
      name: "Burger Junction",
      image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop",
      cuisine: "American",
      description: "Gourmet burgers and crispy fries",
      rating: 4.4,
      reviewCount: 567,
      deliveryTime: "20-30 min",
      distance: "0.5 mi",
      deliveryFee: "1.99",
      status: "busy",
      promotion: "Free Fries",
      isFavorite: false,
      priceRange: "$",
      features: ["free-delivery", "accepts-cash"]
    },
    {
      id: 4,
      name: "Spice Garden",
      image: "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400&h=300&fit=crop",
      cuisine: "Indian",
      description: "Authentic Indian curries and tandoor specialties",
      rating: 4.7,
      reviewCount: 289,
      deliveryTime: "35-45 min",
      distance: "1.8 mi",
      deliveryFee: "4.99",
      status: "open",
      promotion: null,
      isFavorite: false,
      priceRange: "$$",
      features: ["eco-friendly", "group-ordering"]
    },
    {
      id: 5,
      name: "Taco Fiesta",
      image: "https://images.unsplash.com/photo-1565299585323-38174c4a6c18?w=400&h=300&fit=crop",
      cuisine: "Mexican",
      description: "Fresh tacos, burritos, and Mexican street food",
      rating: 4.5,
      reviewCount: 412,
      deliveryTime: "25-35 min",
      distance: "1.0 mi",
      deliveryFee: "2.49",
      status: "open",
      promotion: "Buy 2 Get 1",
      isFavorite: true,
      priceRange: "$",
      features: ["free-delivery", "pickup-available", "accepts-cash"]
    },
    {
      id: 6,
      name: "Sushi Zen",
      image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400&h=300&fit=crop",
      cuisine: "Japanese",
      description: "Fresh sushi and traditional Japanese cuisine",
      rating: 4.9,
      reviewCount: 156,
      deliveryTime: "40-50 min",
      distance: "2.1 mi",
      deliveryFee: "5.99",
      status: "open",
      promotion: null,
      isFavorite: false,
      priceRange: "$$$",
      features: ["eco-friendly", "group-ordering"]
    },
    {
      id: 7,
      name: "Green Bowl",
      image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop",
      cuisine: "Healthy",
      description: "Fresh salads, smoothie bowls, and healthy options",
      rating: 4.3,
      reviewCount: 234,
      deliveryTime: "20-30 min",
      distance: "0.7 mi",
      deliveryFee: "2.99",
      status: "open",
      promotion: null,
      isFavorite: false,
      priceRange: "$$",
      features: ["eco-friendly", "free-delivery"]
    },
    {
      id: 8,
      name: "Pasta Corner",
      image: "https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400&h=300&fit=crop",
      cuisine: "Italian",
      description: "Homemade pasta and Italian comfort food",
      rating: 4.6,
      reviewCount: 178,
      deliveryTime: "30-40 min",
      distance: "1.5 mi",
      deliveryFee: "3.99",
      status: "closed",
      promotion: null,
      isFavorite: false,
      priceRange: "$$",
      features: ["pickup-available", "group-ordering"]
    }
  ];

  const filterRestaurants = (restaurants) => {
    let filtered = [...restaurants];

    // Filter by category
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered?.filter(restaurant => {
        const cuisine = restaurant?.cuisine?.toLowerCase();
        const category = selectedCategory?.toLowerCase();
        
        if (category === 'pizza') return cuisine?.includes('italian');
        if (category === 'asian') return ['chinese', 'japanese', 'thai']?.includes(cuisine);
        if (category === 'mexican') return cuisine?.includes('mexican');
        if (category === 'italian') return cuisine?.includes('italian');
        if (category === 'american') return cuisine?.includes('american');
        if (category === 'indian') return cuisine?.includes('indian');
        if (category === 'chinese') return cuisine?.includes('chinese');
        if (category === 'healthy') return cuisine?.includes('healthy');
        
        return cuisine?.includes(category);
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery?.toLowerCase();
      filtered = filtered?.filter(restaurant =>
        restaurant?.name?.toLowerCase()?.includes(query) ||
        restaurant?.cuisine?.toLowerCase()?.includes(query) ||
        restaurant?.description?.toLowerCase()?.includes(query)
      );
    }

    // Apply advanced filters
    if (appliedFilters) {
      // Price range filter
      if (appliedFilters?.priceRange && appliedFilters?.priceRange?.length > 0) {
        filtered = filtered?.filter(restaurant =>
          appliedFilters?.priceRange?.includes(restaurant?.priceRange)
        );
      }

      // Rating filter
      if (appliedFilters?.rating) {
        const minRating = parseFloat(appliedFilters?.rating);
        filtered = filtered?.filter(restaurant => restaurant?.rating >= minRating);
      }

      // Delivery time filter
      if (appliedFilters?.deliveryTime) {
        const maxTime = parseInt(appliedFilters?.deliveryTime);
        filtered = filtered?.filter(restaurant => {
          const restaurantTime = parseInt(restaurant?.deliveryTime?.split('-')?.[1]);
          return restaurantTime <= maxTime;
        });
      }

      // Cuisine types filter
      if (appliedFilters?.cuisineTypes && appliedFilters?.cuisineTypes?.length > 0) {
        filtered = filtered?.filter(restaurant =>
          appliedFilters?.cuisineTypes?.some(cuisine =>
            restaurant?.cuisine?.toLowerCase()?.includes(cuisine)
          )
        );
      }

      // Features filter
      if (appliedFilters?.features && appliedFilters?.features?.length > 0) {
        filtered = filtered?.filter(restaurant =>
          appliedFilters?.features?.every(feature =>
            restaurant?.features?.includes(feature)
          )
        );
      }
    }

    // Sort by distance (nearest first)
    filtered?.sort((a, b) => {
      const distanceA = parseFloat(a?.distance);
      const distanceB = parseFloat(b?.distance);
      return distanceA - distanceB;
    });

    return filtered;
  };

  const loadRestaurants = () => {
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      let filtered = filterRestaurants(mockRestaurants);
      setRestaurants(filtered);
      setLoading(false);
      setHasMore(false); // For demo, we don't have infinite scroll
    }, 500);
  };

  useEffect(() => {
    loadRestaurants();
  }, [selectedCategory, selectedService, appliedFilters, searchQuery]);

  const handleRefresh = () => {
    setPage(1);
    loadRestaurants();
  };

  if (loading && restaurants?.length === 0) {
    return (
      <div className="px-4 py-6 lg:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)]?.map((_, index) => (
            <div key={index} className="bg-card border border-border rounded-lg overflow-hidden animate-pulse">
              <div className="h-48 bg-muted" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="flex justify-between">
                  <div className="h-3 bg-muted rounded w-1/4" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (restaurants?.length === 0 && !loading) {
    return (
      <div className="px-4 py-12 lg:px-6 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="Search" size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No restaurants found</h3>
          <p className="text-muted-foreground mb-4">
            Try adjusting your filters or search in a different area.
          </p>
          <button
            onClick={handleRefresh}
            className="text-primary hover:text-primary/80 font-medium"
          >
            Refresh results
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-6">
      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {restaurants?.length} restaurants nearby
          </h2>
          {/* <p className="text-sm text-muted-foreground">
            Sorted by distance • Updated {new Date()?.toLocaleTimeString()}
          </p> */}
        </div>
      </div>
      {/* Restaurant Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {restaurants?.map((restaurant) => (
          <RestaurantCard key={restaurant?.id} restaurant={restaurant} />
        ))}
      </div>
      {/* Loading More */}
      {loading && restaurants?.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading more restaurants...</span>
          </div>
        </div>
      )}
      {/* Load More Button */}
      {hasMore && !loading && restaurants?.length > 0 && (
        <div className="flex justify-center py-8">
          <button
            onClick={() => {
              setPage(prev => prev + 1);
              loadRestaurants();
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-micro"
          >
            Load More Restaurants
          </button>
        </div>
      )}
    </div>
  );
};

export default RestaurantGrid;