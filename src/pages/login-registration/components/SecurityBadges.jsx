import React from 'react';
import Icon from '../../../components/AppIcon';

const SecurityBadges = () => {
  const badges = [
    {
      icon: 'Shield',
      text: 'SSL Secured',
      description: '256-bit encryption'
    },
    {
      icon: 'Lock',
      text: 'GDPR Compliant',
      description: 'Data protection'
    },
    {
      icon: 'CheckCircle',
      text: 'SOC 2 Certified',
      description: 'Security standards'
    }
  ];

  return (
    <div className="flex items-center justify-center space-x-6 mt-8 pt-6 border-t border-border">
      {badges?.map((badge, index) => (
        <div key={index} className="flex items-center space-x-2 text-xs text-muted-foreground">
          <Icon name={badge?.icon} size={16} className="text-success" />
          <div>
            <div className="font-medium">{badge?.text}</div>
            <div className="text-xs opacity-75">{badge?.description}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SecurityBadges;