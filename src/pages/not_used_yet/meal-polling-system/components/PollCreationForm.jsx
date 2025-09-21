import React, { useState } from 'react';
import Icon from '../../../../components/AppIcon';
import Button from '../../../../components/ui/custom/Button';
import Input from '../../../../components/ui/custom/Input';
import Select from '../../../../components/ui/custom/Select';
import { Checkbox } from '../../../../components/ui/custom/Checkbox';

const PollCreationForm = ({ onCreatePoll }) => {
  const [pollData, setPollData] = useState({
    title: '',
    restaurants: [],
    mealTypes: [],
    targetAudience: 'all',
    expirationDate: '',
    expirationTime: '',
    allowMultiple: false,
    allowSuggestions: false,
    anonymous: false,
    customMessage: ''
  });

  const restaurantOptions = [
    { value: 'chipotle', label: 'Chipotle Mexican Grill', description: 'Fast-casual Mexican cuisine' },
    { value: 'subway', label: 'Subway', description: 'Fresh sandwiches and salads' },
    { value: 'panera', label: 'Panera Bread', description: 'Bakery-cafe with soups and sandwiches' },
    { value: 'olive-garden', label: 'Olive Garden', description: 'Italian dining with unlimited breadsticks' },
    { value: 'pizza-hut', label: 'Pizza Hut', description: 'Pizza delivery and dine-in' },
    { value: 'kfc', label: 'KFC', description: 'Fried chicken and sides' },
    { value: 'taco-bell', label: 'Taco Bell', description: 'Mexican-inspired fast food' },
    { value: 'mcdonalds', label: 'McDonald\'s', description: 'Classic fast food burgers and fries' }
  ];

  const mealTypeOptions = [
    { id: 'breakfast', label: 'Breakfast' },
    { id: 'lunch', label: 'Lunch' },
    { id: 'dinner', label: 'Dinner' },
    { id: 'snacks', label: 'Snacks' }
  ];

  const targetAudienceOptions = [
    { value: 'all', label: 'All Team Members' },
    { value: 'players', label: 'Players Only' },
    { value: 'staff', label: 'Staff Only' }
  ];

  const handleInputChange = (field, value) => {
    setPollData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMealTypeChange = (mealTypeId, checked) => {
    setPollData(prev => ({
      ...prev,
      mealTypes: checked 
        ? [...prev?.mealTypes, mealTypeId]
        : prev?.mealTypes?.filter(id => id !== mealTypeId)
    }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (pollData?.title && pollData?.restaurants?.length > 0 && pollData?.mealTypes?.length > 0) {
      const newPoll = {
        id: Date.now()?.toString(),
        ...pollData,
        createdAt: new Date(),
        status: 'active',
        votes: [],
        totalVotes: 0
      };
      onCreatePoll(newPoll);
      
      // Reset form
      setPollData({
        title: '',
        restaurants: [],
        mealTypes: [],
        targetAudience: 'all',
        expirationDate: '',
        expirationTime: '',
        allowMultiple: false,
        allowSuggestions: false,
        anonymous: false,
        customMessage: ''
      });
    }
  };

  const isFormValid = pollData?.title && pollData?.restaurants?.length > 0 && pollData?.mealTypes?.length > 0;

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
      <div className="flex items-center space-x-2 mb-6">
        <Icon name="Vote" size={24} className="text-primary" />
        <h2 className="text-xl font-heading font-semibold text-foreground">Create New Poll</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Poll Title */}
        <Input
          label="Poll Title"
          type="text"
          placeholder="e.g., Team Lunch for Friday Practice"
          value={pollData?.title}
          onChange={(e) => handleInputChange('title', e?.target?.value)}
          required
          className="mb-4"
        />

        {/* Restaurant Selection */}
        <Select
          label="Restaurant Options"
          description="Select restaurants for team members to vote on"
          options={restaurantOptions}
          value={pollData?.restaurants}
          onChange={(value) => handleInputChange('restaurants', value)}
          multiple
          searchable
          clearable
          placeholder="Choose restaurants..."
          required
          className="mb-4"
        />

        {/* Meal Types */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Meal Types <span className="text-error">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {mealTypeOptions?.map((mealType) => (
              <Checkbox
                key={mealType?.id}
                label={mealType?.label}
                checked={pollData?.mealTypes?.includes(mealType?.id)}
                onChange={(e) => handleMealTypeChange(mealType?.id, e?.target?.checked)}
              />
            ))}
          </div>
        </div>

        {/* Target Audience */}
        <Select
          label="Target Audience"
          description="Who should receive this poll?"
          options={targetAudienceOptions}
          value={pollData?.targetAudience}
          onChange={(value) => handleInputChange('targetAudience', value)}
          className="mb-4"
        />

        {/* Expiration Date & Time */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Expiration Date"
            type="date"
            value={pollData?.expirationDate}
            onChange={(e) => handleInputChange('expirationDate', e?.target?.value)}
            min={new Date()?.toISOString()?.split('T')?.[0]}
            required
          />
          <Input
            label="Expiration Time"
            type="time"
            value={pollData?.expirationTime}
            onChange={(e) => handleInputChange('expirationTime', e?.target?.value)}
            required
          />
        </div>

        {/* Advanced Options */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-foreground">Advanced Options</h3>
          <div className="space-y-2">
            <Checkbox
              label="Allow multiple selections"
              description="Team members can vote for multiple restaurants"
              checked={pollData?.allowMultiple}
              onChange={(e) => handleInputChange('allowMultiple', e?.target?.checked)}
            />
            <Checkbox
              label="Allow custom suggestions"
              description="Team members can suggest additional restaurants"
              checked={pollData?.allowSuggestions}
              onChange={(e) => handleInputChange('allowSuggestions', e?.target?.checked)}
            />
            <Checkbox
              label="Anonymous voting"
              description="Hide voter identities in results"
              checked={pollData?.anonymous}
              onChange={(e) => handleInputChange('anonymous', e?.target?.checked)}
            />
          </div>
        </div>

        {/* Custom Message */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Custom Message (Optional)
          </label>
          <textarea
            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
            rows={3}
            placeholder="Add a custom message to include with the poll..."
            value={pollData?.customMessage}
            onChange={(e) => handleInputChange('customMessage', e?.target?.value)}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPollData({
              title: '',
              restaurants: [],
              mealTypes: [],
              targetAudience: 'all',
              expirationDate: '',
              expirationTime: '',
              allowMultiple: false,
              allowSuggestions: false,
              anonymous: false,
              customMessage: ''
            })}
          >
            Clear Form
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={!isFormValid}
            iconName="Send"
            iconPosition="left"
          >
            Create Poll
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PollCreationForm;