import React from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/AppIcon';

export function NextMealWidget({ meal }) {
  const navigate = useNavigate();
  
  if (!meal) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
        <h3 className="text-lg font-semibold text-foreground mb-2">Next Scheduled Order</h3>
        <p className="text-muted-foreground">No upcoming meals scheduled.</p>
        <button
          onClick={() => navigate('/calendar-order-scheduling')}
          className="mt-3 text-primary hover:underline font-medium"
        >
          Schedule a meal →
        </button>
      </div>
    );
  }

  const scheduledDate = new Date(`${meal.date}T${meal.time}`);
  const formattedDate = scheduledDate?.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
  const formattedTime = scheduledDate?.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  const service = (meal?.fulfillment || '').toLowerCase();
  const serviceIcon = service === 'delivery' ? 'Truck' : 'Package';
  const statusLabel = (meal?.status === 'scheduled' || meal?.status === 'confirmed') ? 'Scheduled' : (meal?.status || 'Scheduled');
  const statusClasses = statusLabel === 'Scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
      <h3 className="text-lg font-semibold text-foreground mb-2">Next Scheduled Order</h3>
      <div className="space-y-1">
        <div className="text-xl font-medium text-foreground">
          {formattedDate} at {formattedTime}
        </div>
        {/* Desktop/tablet: one line */}
        <div className="hidden sm:flex text-sm text-muted-foreground items-center gap-2">
          <Icon name={serviceIcon} size={14} className="text-muted-foreground" />
          <span className="truncate">{meal?.restaurant || 'Restaurant TBD'} | {meal?.location || 'Location TBD'}</span>
        </div>
        {/* Mobile: address on its own line */}
        <div className="flex sm:hidden text-sm text-muted-foreground items-start gap-2">
          <Icon name={serviceIcon} size={14} className="text-muted-foreground mt-2.5" />
          <div className="min-w-0">
            <div className="truncate">{meal?.restaurant || 'Restaurant TBD'}</div>
            <div className="break-words">{meal?.location || 'Location TBD'}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex justify-between items-center text-sm">
          <span className="text-muted-foreground">Status</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusClasses}`}>
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
