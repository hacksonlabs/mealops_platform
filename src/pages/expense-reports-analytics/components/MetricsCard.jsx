import React from 'react';
import Icon from '../../../components/AppIcon';

const MetricsCard = ({ title, value, subtitle, trend, trendValue, icon, iconColor = 'text-primary' }) => {
  const getTrendIcon = () => {
    if (trend === 'up') return 'TrendingUp';
    if (trend === 'down') return 'TrendingDown';
    return 'Minus';
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'text-success';
    if (trend === 'down') return 'text-error';
    return 'text-muted-foreground';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground mb-2">{value}</p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-muted ${iconColor}`}>
          <Icon name={icon} size={24} />
        </div>
      </div>
      {trendValue && (
        <div className="flex items-center mt-4 pt-4 border-t border-border">
          <Icon name={getTrendIcon()} size={16} className={`mr-1 ${getTrendColor()}`} />
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {trendValue}
          </span>
          <span className="text-sm text-muted-foreground ml-1">vs last month</span>
        </div>
      )}
    </div>
  );
};

export default MetricsCard;