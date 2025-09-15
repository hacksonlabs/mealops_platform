import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../../components/AppIcon';
import Image from '../../../../components/AppImage';
import Button from '../../../../components/ui/custom/Button';

const QuickReorderSection = () => {
  const navigate = useNavigate();

  const recentOrders = [
    {
      id: 1,
      restaurantName: "Tony\'s Pizzeria",
      restaurantImage: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=400&h=300&fit=crop",
      lastOrderDate: "2 days ago",
      items: ["Margherita Pizza", "Caesar Salad"],
      totalAmount: 31.98,
      rating: 4.8,
      deliveryTime: "25-35 min"
    },
    {
      id: 2,
      restaurantName: "Dragon Palace",
      restaurantImage: "https://images.unsplash.com/photo-1563379091339-03246963d51a?w=400&h=300&fit=crop",
      lastOrderDate: "1 week ago",
      items: ["Sweet & Sour Chicken", "Fried Rice"],
      totalAmount: 24.50,
      rating: 4.6,
      deliveryTime: "30-40 min"
    }
  ];

  const handleReorder = (order) => {
    navigate('/restaurant-detail-menu', { 
      state: { 
        restaurant: {
          name: order?.restaurantName,
          image: order?.restaurantImage,
          rating: order?.rating,
          deliveryTime: order?.deliveryTime
        },
        reorderItems: order?.items
      } 
    });
  };

  if (recentOrders?.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border-b border-border">
      <div className="px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Quick Reorder</h2>
          <Button variant="ghost" size="sm">
            <span className="text-sm text-primary">View All</span>
            <Icon name="ChevronRight" size={16} className="ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recentOrders?.map((order) => (
            <div
              key={order?.id}
              className="bg-muted/50 border border-border rounded-lg p-4 hover:shadow-elevation-1 transition-layout"
            >
              <div className="flex items-start space-x-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={order?.restaurantImage}
                    alt={order?.restaurantName}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {order?.restaurantName}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Last ordered {order?.lastOrderDate}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Icon name="Star" size={12} className="text-warning fill-current" />
                      <span className="text-xs font-medium text-foreground">
                        {order?.rating}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    <p className="text-xs text-muted-foreground mb-1">Previous order:</p>
                    <p className="text-sm text-foreground line-clamp-2">
                      {order?.items?.join(", ")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold text-foreground font-mono">
                        ${order?.totalAmount?.toFixed(2)}
                      </span>
                      <div className="flex items-center space-x-1">
                        <Icon name="Clock" size={12} className="text-muted-foreground" />
                        <span className="text-xs text-muted-foreground font-mono">
                          {order?.deliveryTime}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorder(order)}
                      className="text-xs"
                    >
                      <Icon name="RotateCcw" size={12} className="mr-1" />
                      Reorder
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickReorderSection;