import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { Checkbox } from '../../../components/ui/Checkbox';

const ScheduleMealModal = ({ 
  isOpen, 
  onClose, 
  selectedDate, 
  onSchedule,
  teamMembers = [],
  savedTemplates = []
}) => {
  const [formData, setFormData] = useState({
    restaurant: '',
    mealType: 'lunch',
    time: '12:00',
    selectedMembers: [],
    notes: '',
    useTemplate: null
  });

  const restaurants = [
    { id: 'chipotle', name: 'Chipotle Mexican Grill', category: 'Fast Casual' },
    { id: 'subway', name: 'Subway', category: 'Fast Food' },
    { id: 'panera', name: 'Panera Bread', category: 'Bakery Cafe' },
    { id: 'olive-garden', name: 'Olive Garden', category: 'Italian' },
    { id: 'local-deli', name: 'Local Deli & Catering', category: 'Deli' },
    { id: 'pizza-hut', name: 'Pizza Hut', category: 'Pizza' }
  ];

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: 'Coffee' },
    { value: 'lunch', label: 'Lunch', icon: 'Utensils' },
    { value: 'dinner', label: 'Dinner', icon: 'UtensilsCrossed' },
    { value: 'snack', label: 'Snack', icon: 'Cookie' }
  ];

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!formData?.restaurant || formData?.selectedMembers?.length === 0) {
      return;
    }

    const orderData = {
      id: Date.now(),
      date: selectedDate?.toISOString(),
      restaurant: restaurants?.find(r => r?.id === formData?.restaurant)?.name || formData?.restaurant,
      mealType: formData?.mealType,
      time: formData?.time,
      attendees: formData?.selectedMembers?.length,
      members: formData?.selectedMembers,
      notes: formData?.notes,
      status: 'scheduled',
      createdAt: new Date()?.toISOString()
    };

    onSchedule(orderData);
    onClose();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      restaurant: '',
      mealType: 'lunch',
      time: '12:00',
      selectedMembers: [],
      notes: '',
      useTemplate: null
    });
  };

  const handleMemberToggle = (memberId) => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev?.selectedMembers?.includes(memberId)
        ? prev?.selectedMembers?.filter(id => id !== memberId)
        : [...prev?.selectedMembers, memberId]
    }));
  };

  const handleSelectAll = () => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev?.selectedMembers?.length === teamMembers?.length 
        ? [] 
        : teamMembers?.map(member => member?.id)
    }));
  };

  const handleTemplateSelect = (template) => {
    setFormData(prev => ({
      ...prev,
      restaurant: template?.restaurant,
      mealType: template?.mealType,
      time: template?.time,
      selectedMembers: template?.members || [],
      notes: template?.notes || '',
      useTemplate: template?.id
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">
              Schedule Meal
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedDate?.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            iconName="X"
            iconSize={20}
          />
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Quick Templates */}
            {savedTemplates?.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Quick Templates</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {savedTemplates?.map(template => (
                    <button
                      key={template?.id}
                      type="button"
                      onClick={() => handleTemplateSelect(template)}
                      className={`
                        p-3 text-left border rounded-md transition-athletic
                        ${formData?.useTemplate === template?.id
                          ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <div className="font-medium text-sm text-foreground">
                        {template?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {template?.restaurant} • {template?.mealType} • {template?.members?.length || 0} people
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Restaurant Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Restaurant *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {restaurants?.map(restaurant => (
                  <button
                    key={restaurant?.id}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, restaurant: restaurant?.id }))}
                    className={`
                      p-3 text-left border rounded-md transition-athletic
                      ${formData?.restaurant === restaurant?.id
                        ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                      }
                    `}
                  >
                    <div className="font-medium text-sm text-foreground">
                      {restaurant?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {restaurant?.category}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Meal Type and Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">
                  Meal Type
                </label>
                <div className="space-y-2">
                  {mealTypes?.map(type => (
                    <button
                      key={type?.value}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, mealType: type?.value }))}
                      className={`
                        w-full flex items-center space-x-3 p-3 border rounded-md transition-athletic
                        ${formData?.mealType === type?.value
                          ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50'
                        }
                      `}
                    >
                      <Icon name={type?.icon} size={16} />
                      <span className="text-sm font-medium">{type?.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  label="Time"
                  type="time"
                  value={formData?.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e?.target?.value }))}
                  required
                />
              </div>
            </div>

            {/* Team Member Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Team Members * ({formData?.selectedMembers?.length} selected)
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {formData?.selectedMembers?.length === teamMembers?.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              
              <div className="max-h-48 overflow-y-auto border border-border rounded-md">
                {teamMembers?.map(member => (
                  <div
                    key={member?.id}
                    className="flex items-center space-x-3 p-3 border-b border-border last:border-b-0 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={formData?.selectedMembers?.includes(member?.id)}
                      onChange={() => handleMemberToggle(member?.id)}
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {member?.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member?.role} • {member?.email}
                      </div>
                      {member?.allergies && (
                        <div className="text-xs text-warning mt-1">
                          Allergies: {member?.allergies}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Special Instructions
              </label>
              <textarea
                value={formData?.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e?.target?.value }))}
                placeholder="Any special dietary requirements, delivery instructions, etc."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-md text-sm bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData?.restaurant || formData?.selectedMembers?.length === 0}
            iconName="Calendar"
            iconSize={16}
          >
            Schedule Meal
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleMealModal;