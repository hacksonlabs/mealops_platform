import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const ServiceToggle = ({ onServiceChange }) => {
  const [selectedService, setSelectedService] = useState('delivery');

  const services = [
    {
      id: 'delivery',
      label: 'Delivery',
      icon: 'Truck',
      // description: 'Delivered to your door'
    },
    {
      id: 'pickup',
      label: 'Pickup',
      icon: 'Store',
      // description: 'Ready for pickup'
    }
  ];

  const handleServiceChange = (serviceId) => {
    setSelectedService(serviceId);
    onServiceChange?.(serviceId);
  };

  return (
    <div className="bg-card border-b border-border">
      <div className="px-4 py-4 lg:px-6">
        <div className="flex items-center justify-center">
          <div className="bg-muted p-1 rounded-lg flex">
            {services?.map((service) => (
              <Button
                key={service?.id}
                variant={selectedService === service?.id ? "default" : "ghost"}
                onClick={() => handleServiceChange(service?.id)}
                className={`flex items-center space-x-2 px-6 py-3 rounded-md transition-micro ${
                  selectedService === service?.id 
                    ? 'bg-primary text-primary-foreground shadow-elevation-1' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon 
                  name={service?.icon} 
                  size={18} 
                  className={selectedService === service?.id ? 'text-primary-foreground' : 'text-current'}
                />
                <div className="text-left">
                  <div className="text-sm font-medium">{service?.label}</div>
                  <div className="text-xs opacity-80 hidden sm:block">{service?.description}</div>
                </div>
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ServiceToggle;