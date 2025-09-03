import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const DeliveryAddressBanner = () => {
  const [currentAddress, setCurrentAddress] = useState('123 Main St, New York, NY 10001');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddressChange = () => {
    setIsModalOpen(true);
  };

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation?.getCurrentPosition(
        (position) => {
          console.log('Location detected:', position?.coords);
          setCurrentAddress('Current Location Detected');
          setIsModalOpen(false);
        },
        (error) => {
          console.error('Location error:', error);
        }
      );
    }
  };

  return (
    <>
      <div className="bg-card border-b border-border shadow-elevation-1">
        <div className="px-4 py-3 lg:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <div className="w-2 h-2 rounded-full bg-success" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <Icon name="MapPin" size={16} className="text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    Delivering to: {currentAddress}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleAddressChange}
              className="flex-shrink-0 ml-3"
            >
              <Icon name="Edit2" size={14} className="mr-1" />
              <span className="hidden sm:inline">Change</span>
            </Button>
          </div>
        </div>
      </div>
      {/* Address Change Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[1100] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg shadow-elevation-2 w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Update Delivery Address</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsModalOpen(false)}
                >
                  <Icon name="X" size={20} />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Enter delivery address"
                    value={currentAddress}
                    onChange={(e) => setCurrentAddress(e?.target?.value)}
                    className="w-full px-4 py-3 pl-10 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                  <Icon 
                    name="Search" 
                    size={18} 
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" 
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleUseCurrentLocation}
                  className="w-full justify-start"
                >
                  <Icon name="Navigation" size={16} className="mr-2" />
                  Use Current Location
                </Button>

                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium text-foreground mb-2">Recent Addresses</h4>
                  <div className="space-y-2">
                    <button 
                      className="w-full text-left p-2 hover:bg-muted rounded-lg transition-micro"
                      onClick={() => {
                        setCurrentAddress('456 Oak Avenue, Brooklyn, NY');
                        setIsModalOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon name="MapPin" size={14} className="text-muted-foreground" />
                        <span className="text-sm">456 Oak Avenue, Brooklyn, NY</span>
                      </div>
                    </button>
                    <button 
                      className="w-full text-left p-2 hover:bg-muted rounded-lg transition-micro"
                      onClick={() => {
                        setCurrentAddress('789 Business Plaza, Manhattan, NY')
                        setIsModalOpen(false);
                      }}
                    >
                      <div className="flex items-center space-x-2">
                        <Icon name="Building" size={14} className="text-muted-foreground" />
                        <span className="text-sm">789 Business Plaza, Manhattan, NY</span>
                      </div>
                    </button>
                  </div>
                </div>

                <div className="flex space-x-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1"
                  >
                    Update Address
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DeliveryAddressBanner;