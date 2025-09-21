import React from 'react';
import Icon from '../../../../components/AppIcon';

const LocationAnalytics = ({ locations, restaurants }) => {
  // Calculate analytics data
  const locationTypeBreakdown = locations?.reduce((acc, location) => {
    const type = location?.location_type || 'other';
    acc[type] = (acc?.[type] || 0) + 1;
    return acc;
  }, {});

  const cuisineBreakdown = restaurants?.reduce((acc, restaurant) => {
    const cuisine = restaurant?.cuisine_type || 'other';
    acc[cuisine] = (acc?.[cuisine] || 0) + 1;
    return acc;
  }, {});

  const getTypeColor = (type) => {
    const colors = {
      school: 'bg-blue-500',
      hotel: 'bg-purple-500',
      gym: 'bg-green-500',
      venue: 'bg-amber-500',
      other: 'bg-gray-500'
    };
    return colors?.[type] || colors?.other;
  };

  const getCuisineColor = (cuisine) => {
    const colors = {
      american: 'bg-red-500',
      italian: 'bg-green-500',
      chinese: 'bg-yellow-500',
      mexican: 'bg-orange-500',
      indian: 'bg-purple-500',
      japanese: 'bg-pink-500',
      mediterranean: 'bg-blue-500',
      thai: 'bg-indigo-500',
      other: 'bg-gray-500'
    };
    return colors?.[cuisine] || colors?.other;
  };

  const formatPercentage = (count, total) => {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <h3 className="text-lg font-semibold text-foreground mb-4">Usage Overview</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Orders</span>
              <span className="text-sm font-medium text-foreground">0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Most Used Location</span>
              <span className="text-sm font-medium text-foreground">
                {locations?.[0]?.name || 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg Orders/Week</span>
              <span className="text-sm font-medium text-foreground">0</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <h3 className="text-lg font-semibold text-foreground mb-4">Spending Analysis</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Spent</span>
              <span className="text-sm font-medium text-foreground">$0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Top Location</span>
              <span className="text-sm font-medium text-foreground">N/A</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg per Order</span>
              <span className="text-sm font-medium text-foreground">$0</span>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <h3 className="text-lg font-semibold text-foreground mb-4">Success Rate</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Delivery Success</span>
              <span className="text-sm font-medium text-foreground">100%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">On-Time Rate</span>
              <span className="text-sm font-medium text-foreground">95%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Issues Reported</span>
              <span className="text-sm font-medium text-foreground">0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Location Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <h3 className="text-lg font-semibold text-foreground mb-4">Locations by Type</h3>
          {Object.keys(locationTypeBreakdown)?.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(locationTypeBreakdown)?.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getTypeColor(type)}`}></div>
                    <span className="text-sm text-foreground capitalize">{type}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatPercentage(count, locations?.length)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Icon name="MapPin" size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No location data available</p>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
          <h3 className="text-lg font-semibold text-foreground mb-4">Cuisine Preferences</h3>
          {Object.keys(cuisineBreakdown)?.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(cuisineBreakdown)?.map(([cuisine, count]) => (
                <div key={cuisine} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${getCuisineColor(cuisine)}`}></div>
                    <span className="text-sm text-foreground capitalize">{cuisine}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-foreground">{count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({formatPercentage(count, restaurants?.length)}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Icon name="Store" size={32} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No restaurant data available</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Locations */}
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-4">Most Active Locations</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Location</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Restaurants</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Orders</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Total Spent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {locations?.slice(0, 5)?.map((location, index) => (
                <tr key={location?.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-foreground">
                    {location?.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground capitalize">
                    {location?.location_type}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {location?.restaurants?.length || 0}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">0</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">$0</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {locations?.length === 0 && (
          <div className="text-center py-8">
            <Icon name="BarChart3" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No location analytics available</p>
            <p className="text-xs text-muted-foreground">Analytics will appear after you start placing orders</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationAnalytics;