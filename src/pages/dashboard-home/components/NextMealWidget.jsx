import React from 'react';
import { useNavigate } from 'react-router-dom';

export function NextMealWidget({ meal }) {
  const navigate = useNavigate();
  
  if (!meal) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Scheduled Meal</h3>
        <p className="text-gray-600">No upcoming meals scheduled.</p>
        <button 
          onClick={() => navigate('/calendar-order-scheduling')}
          className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
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

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Scheduled Meal</h3>
      <div className="space-y-2">
        <div className="text-xl font-medium text-gray-900">
          {formattedDate} at {formattedTime}
        </div>
        <div className="text-lg text-blue-600 font-medium">
          {meal?.restaurant}
        </div>
        <div className="text-gray-600">
          {meal?.restaurant || 'Restaurant TBD'} • {meal?.location || 'Location TBD'}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">Status</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            meal?.status === 'confirmed' ? 'bg-green-100 text-green-800'
              : meal?.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {meal?.status?.charAt(0)?.toUpperCase() + meal?.status?.slice(1)}
          </span>
        </div>
      </div>
    </div>
  );
}