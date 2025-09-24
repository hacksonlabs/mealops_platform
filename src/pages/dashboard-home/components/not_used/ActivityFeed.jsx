import React, { useState } from 'react';
import Icon from '../../../../components/AppIcon';

const ActivityFeed = ({ activities }) => {
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpanded = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded?.has(id)) {
      newExpanded?.delete(id);
    } else {
      newExpanded?.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getActivityIcon = (type) => {
    const icons = {
      'poll_created': 'Vote',
      'poll_completed': 'CheckCircle',
      'order_confirmed': 'ShoppingCart',
      'order_cancelled': 'XCircle',
      'team_member_added': 'UserPlus',
      'meal_scheduled': 'Calendar',
      'payment_processed': 'CreditCard'
    };
    return icons?.[type] || 'Bell';
  };

  const getActivityColor = (type) => {
    const colors = {
      'poll_created': 'text-accent bg-accent/10',
      'poll_completed': 'text-success bg-success/10',
      'order_confirmed': 'text-primary bg-primary/10',
      'order_cancelled': 'text-error bg-error/10',
      'team_member_added': 'text-secondary bg-secondary/10',
      'meal_scheduled': 'text-primary bg-primary/10',
      'payment_processed': 'text-success bg-success/10'
    };
    return colors?.[type] || 'text-muted-foreground bg-muted';
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - activityTime) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">Recent Activity</h3>
        <button className="text-sm text-primary hover:text-primary/80 transition-athletic">
          View All
        </button>
      </div>
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {activities?.map((activity) => (
          <div key={activity?.id} className="flex items-start space-x-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${getActivityColor(activity?.type)}`}>
              <Icon name={getActivityIcon(activity?.type)} size={16} />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{activity?.title}</p>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(activity?.timestamp)}
                </span>
              </div>
              
              <p className="text-sm text-muted-foreground mt-1">
                {activity?.description}
              </p>

              {activity?.details && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleExpanded(activity?.id)}
                    className="text-xs text-primary hover:text-primary/80 transition-athletic flex items-center"
                  >
                    {expandedItems?.has(activity?.id) ? 'Show less' : 'Show more'}
                    <Icon 
                      name={expandedItems?.has(activity?.id) ? 'ChevronUp' : 'ChevronDown'} 
                      size={12} 
                      className="ml-1" 
                    />
                  </button>
                  
                  {expandedItems?.has(activity?.id) && (
                    <div className="mt-2 p-3 bg-muted rounded-md">
                      <p className="text-xs text-muted-foreground">{activity?.details}</p>
                    </div>
                  )}
                </div>
              )}

              {activity?.actionRequired && (
                <div className="mt-2">
                  <button className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-md hover:bg-accent/80 transition-athletic">
                    {activity?.actionText || 'Take Action'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {activities?.length === 0 && (
          <div className="text-center py-8">
            <Icon name="Activity" size={48} className="text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;