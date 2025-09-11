import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const RestaurantInfo = ({ restaurant }) => {
  const [activeTab, setActiveTab] = useState('info');
  const [showAllReviews, setShowAllReviews] = useState(false);

  const tabs = [
    { id: 'info', label: 'Info', icon: 'Info' },
    { id: 'reviews', label: 'Reviews', icon: 'Star' },
    { id: 'location', label: 'Location', icon: 'MapPin' }
  ];

  const displayedReviews = showAllReviews ? restaurant?.reviews : restaurant?.reviews?.slice(0, 3);

  return (
    <div className="bg-card border-t border-border mt-8">
      {/* Tab Navigation */}
      <div className="border-b border-border">
        <div className="flex">
          {tabs?.map((tab) => (
            <Button
              key={tab?.id}
              variant="ghost"
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center space-x-2 px-6 py-4 rounded-none border-b-2 transition-micro ${
                activeTab === tab?.id
                  ? 'border-primary text-primary bg-primary/5' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={16} />
              <span>{tab?.label}</span>
            </Button>
          ))}
        </div>
      </div>
      {/* Tab Content */}
      <div className="p-6">
        {/* Restaurant Info Tab */}
        {activeTab === 'info' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Restaurant Information</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Icon name="Clock" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Hours</h4>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {restaurant?.hours?.map((hour, index) => (
                          <div key={index} className="flex justify-between">
                            <span>{hour?.day}</span>
                            <span>{hour?.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Icon name="Phone" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Contact</h4>
                      <p className="text-sm text-muted-foreground">{restaurant?.phone}</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Icon name="MapPin" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Address</h4>
                      <p className="text-sm text-muted-foreground">{restaurant?.address}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <Icon name="DollarSign" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Pricing</h4>
                      <p className="text-sm text-muted-foreground">
                        Price Range: {restaurant?.priceRange}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Delivery Fee: ${restaurant?.deliveryFee}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Minimum Order: ${restaurant?.minimumOrder}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <Icon name="Truck" size={20} className="text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">Delivery Info</h4>
                      <p className="text-sm text-muted-foreground">
                        Delivery Time: {restaurant?.deliveryTime}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pickup Time: {restaurant?.pickupTime}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Distance: {restaurant?.distance}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {restaurant?.features && restaurant?.features?.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-3">Features</h4>
                <div className="flex flex-wrap gap-2">
                  {restaurant?.features?.map((feature, index) => (
                    <div key={index} className="bg-muted text-muted-foreground px-3 py-1 rounded-full text-sm">
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Customer Reviews</h3>
              
              {/* Rating Summary */}
              <div className="bg-muted rounded-lg p-4 mb-6">
                <div className="flex items-center space-x-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-foreground">
                      {restaurant?.rating}
                    </div>
                    <div className="flex items-center justify-center space-x-1 mb-1">
                      {[...Array(5)]?.map((_, i) => (
                        <Icon
                          key={i}
                          name="Star"
                          size={16}
                          className={i < Math.floor(restaurant?.rating) ? "text-accent fill-current" : "text-muted-foreground"}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {restaurant?.reviewCount} reviews
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    {restaurant?.ratingBreakdown?.map((rating, index) => (
                      <div key={index} className="flex items-center space-x-2 mb-1">
                        <span className="text-sm w-8">{5 - index}</span>
                        <Icon name="Star" size={12} className="text-accent" />
                        <div className="flex-1 bg-border rounded-full h-2">
                          <div
                            className="bg-accent h-2 rounded-full"
                            style={{ width: `${rating?.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-12">
                          {rating?.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Individual Reviews */}
              <div className="space-y-4">
                {displayedReviews?.map((review) => (
                  <div key={review?.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold">
                        {review?.userName?.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h5 className="font-medium text-foreground">{review?.userName}</h5>
                            <div className="flex items-center space-x-1">
                              {[...Array(5)]?.map((_, i) => (
                                <Icon
                                  key={i}
                                  name="Star"
                                  size={14}
                                  className={i < review?.rating ? "text-accent fill-current" : "text-muted-foreground"}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {review?.date}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {review?.comment}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {restaurant?.reviews?.length > 3 && (
                <div className="text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAllReviews(!showAllReviews)}
                  >
                    {showAllReviews ? 'Show Less' : `Show All ${restaurant?.reviews?.length} Reviews`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Location Tab */}
        {activeTab === 'location' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Location & Directions</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Address</h4>
                      <p className="text-muted-foreground">{restaurant?.address}</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Distance</h4>
                      <p className="text-muted-foreground">{restaurant?.distance} from your location</p>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-foreground mb-2">Delivery Zone</h4>
                      <p className="text-muted-foreground">
                        We deliver within {restaurant?.deliveryRadius} radius
                      </p>
                    </div>
                    
                    <Button variant="outline" className="w-full">
                      <Icon name="Navigation" size={16} className="mr-2" />
                      Get Directions
                    </Button>
                  </div>
                </div>
                
                <div>
                  <div className="w-full h-64 bg-muted rounded-lg overflow-hidden">
                    <iframe
                      width="100%"
                      height="100%"
                      loading="lazy"
                      title={restaurant?.name}
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps?q=${restaurant?.coordinates?.lat},${restaurant?.coordinates?.lng}&z=14&output=embed`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RestaurantInfo;