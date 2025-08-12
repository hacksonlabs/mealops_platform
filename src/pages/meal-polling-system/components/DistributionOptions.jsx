import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { Checkbox } from '../../../components/ui/Checkbox';

const DistributionOptions = ({ onSendPoll, selectedPoll }) => {
  const [distributionSettings, setDistributionSettings] = useState({
    sendEmail: true,
    sendSMS: true,
    customEmailTemplate: false,
    customSMSTemplate: false,
    emailSubject: '',
    emailMessage: '',
    smsMessage: '',
    scheduleDelivery: false,
    deliveryDate: '',
    deliveryTime: ''
  });

  const [isExpanded, setIsExpanded] = useState(false);

  const defaultEmailTemplate = `Hi there!\n\nYou have a new meal poll to vote on: "${selectedPoll?.title || 'Team Meal Poll'}"\n\nPlease cast your vote by clicking the link below. Your input helps us make the best decision for the team!\n\nThanks,\nMealOps Team`;

  const defaultSMSTemplate = `🍽️ New meal poll: "${selectedPoll?.title || 'Team Meal Poll'}". Vote now! Reply STOP to opt out.`;

  const handleSettingChange = (setting, value) => {
    setDistributionSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };

  const handleSendPoll = () => {
    if (!selectedPoll) return;

    const distributionData = {
      pollId: selectedPoll?.id,
      methods: {
        email: distributionSettings?.sendEmail,
        sms: distributionSettings?.sendSMS
      },
      templates: {
        emailSubject: distributionSettings?.customEmailTemplate 
          ? distributionSettings?.emailSubject 
          : `Vote on: ${selectedPoll?.title}`,
        emailMessage: distributionSettings?.customEmailTemplate 
          ? distributionSettings?.emailMessage 
          : defaultEmailTemplate,
        smsMessage: distributionSettings?.customSMSTemplate 
          ? distributionSettings?.smsMessage 
          : defaultSMSTemplate
      },
      scheduling: distributionSettings?.scheduleDelivery ? {
        date: distributionSettings?.deliveryDate,
        time: distributionSettings?.deliveryTime
      } : null
    };

    onSendPoll(distributionData);
  };

  const isFormValid = (distributionSettings?.sendEmail || distributionSettings?.sendSMS) && selectedPoll;

  if (!selectedPoll) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Icon name="Send" size={24} className="text-primary" />
          <h2 className="text-xl font-heading font-semibold text-foreground">Distribution Options</h2>
        </div>
        <div className="text-center py-8">
          <Icon name="MessageSquare" size={48} className="text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">No Poll Selected</h3>
          <p className="text-sm text-muted-foreground">
            Create a poll first to configure distribution options
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Icon name="Send" size={24} className="text-primary" />
          <h2 className="text-xl font-heading font-semibold text-foreground">Distribution Options</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName={isExpanded ? "ChevronUp" : "ChevronDown"}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>
      {/* Selected Poll Info */}
      <div className="mb-6 p-4 bg-muted rounded-lg">
        <h3 className="font-medium text-foreground mb-1">Selected Poll:</h3>
        <p className="text-sm text-muted-foreground">{selectedPoll?.title}</p>
        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
          <span>{selectedPoll?.restaurants?.length} restaurants</span>
          <span>{selectedPoll?.targetAudience === 'all' ? 'All team members' : selectedPoll?.targetAudience}</span>
        </div>
      </div>
      {/* Basic Distribution Methods */}
      <div className="space-y-4 mb-6">
        <h3 className="text-sm font-medium text-foreground">Distribution Methods</h3>
        <div className="space-y-3">
          <Checkbox
            label="Send via Email"
            description="Send poll link via email with detailed information"
            checked={distributionSettings?.sendEmail}
            onChange={(e) => handleSettingChange('sendEmail', e?.target?.checked)}
          />
          <Checkbox
            label="Send via SMS"
            description="Send poll link via text message for quick access"
            checked={distributionSettings?.sendSMS}
            onChange={(e) => handleSettingChange('sendSMS', e?.target?.checked)}
          />
        </div>
      </div>
      {/* Advanced Options */}
      {isExpanded && (
        <div className="space-y-6 border-t border-border pt-6">
          {/* Custom Templates */}
          {distributionSettings?.sendEmail && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Email Template</h4>
                <Checkbox
                  label="Customize"
                  checked={distributionSettings?.customEmailTemplate}
                  onChange={(e) => handleSettingChange('customEmailTemplate', e?.target?.checked)}
                />
              </div>
              
              {distributionSettings?.customEmailTemplate ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Email Subject
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      placeholder={`Vote on: ${selectedPoll?.title}`}
                      value={distributionSettings?.emailSubject}
                      onChange={(e) => handleSettingChange('emailSubject', e?.target?.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Email Message
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                      rows={4}
                      placeholder={defaultEmailTemplate}
                      value={distributionSettings?.emailMessage}
                      onChange={(e) => handleSettingChange('emailMessage', e?.target?.value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-background border border-border rounded-md">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {defaultEmailTemplate}
                  </p>
                </div>
              )}
            </div>
          )}

          {distributionSettings?.sendSMS && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">SMS Template</h4>
                <Checkbox
                  label="Customize"
                  checked={distributionSettings?.customSMSTemplate}
                  onChange={(e) => handleSettingChange('customSMSTemplate', e?.target?.checked)}
                />
              </div>
              
              {distributionSettings?.customSMSTemplate ? (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    SMS Message (160 characters max)
                  </label>
                  <textarea
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none"
                    rows={3}
                    maxLength={160}
                    placeholder={defaultSMSTemplate}
                    value={distributionSettings?.smsMessage}
                    onChange={(e) => handleSettingChange('smsMessage', e?.target?.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {distributionSettings?.smsMessage?.length}/160 characters
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-background border border-border rounded-md">
                  <p className="text-sm text-muted-foreground">
                    {defaultSMSTemplate}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scheduled Delivery */}
          <div className="space-y-4">
            <Checkbox
              label="Schedule Delivery"
              description="Send the poll at a specific date and time"
              checked={distributionSettings?.scheduleDelivery}
              onChange={(e) => handleSettingChange('scheduleDelivery', e?.target?.checked)}
            />
            
            {distributionSettings?.scheduleDelivery && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Delivery Date
                  </label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    min={new Date()?.toISOString()?.split('T')?.[0]}
                    value={distributionSettings?.deliveryDate}
                    onChange={(e) => handleSettingChange('deliveryDate', e?.target?.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Delivery Time
                  </label>
                  <input
                    type="time"
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                    value={distributionSettings?.deliveryTime}
                    onChange={(e) => handleSettingChange('deliveryTime', e?.target?.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Send Button */}
      <div className="mt-6 pt-4 border-t border-border">
        <Button
          variant="default"
          fullWidth
          disabled={!isFormValid}
          iconName="Send"
          iconPosition="left"
          onClick={handleSendPoll}
        >
          {distributionSettings?.scheduleDelivery ? 'Schedule Poll' : 'Send Poll Now'}
        </Button>
        
        {!isFormValid && (
          <p className="text-xs text-error mt-2 text-center">
            Please select at least one distribution method
          </p>
        )}
      </div>
    </div>
  );
};

export default DistributionOptions;