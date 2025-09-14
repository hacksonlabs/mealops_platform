import React, { useState, useEffect } from 'react';
import Header from '../../components/ui/Header';
import Button from '../../components/ui/custom/Button';
import Input from '../../components/ui/custom/Input';
import Select from '../../components/ui/custom/Select';
import Icon from '../../components/AppIcon';
import LocationCard from './components/LocationCard';
import AddLocationAddressModal from './components/AddLocationAddressModal';
import AddLocationModal from './components/AddLocationModal';
import EditLocationModal from './components/EditLocationModal';
import AddRestaurantModal from './components/AddRestaurantModal';
import { locationService } from '../../services/locationService';
import { teamService } from '../../services/teamService';
import { useAuth } from '../../contexts';

const SavedAddressesLocations = () => {
  const { user: authUser, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [userTeam, setUserTeam] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationTypeFilter, setLocationTypeFilter] = useState('all');
  const [expandedLocations, setExpandedLocations] = useState({});
  
  // Modal states
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [showEditLocationModal, setShowEditLocationModal] = useState(false);
  const [showAddRestaurantModal, setShowAddRestaurantModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showAddLocationAddressModal, setShowAddLocationAddressModal] = useState(false);
  const [selectedLocationForAddress, setSelectedLocationForAddress] = useState(null);

  // Load data on mount
  useEffect(() => {
    if (session?.user) {
      loadTeamData();
    }
  }, [session]);

  // Filter locations when search term or filters change
  useEffect(() => {
    filterData();
  }, [locations, searchTerm, locationTypeFilter]);

  const loadTeamData = async () => {
    setLoading(true);
    try {
      // First get user's team information
      const teamResult = await teamService?.getUserTeam();
      
      if (teamResult?.error) {
        throw new Error(teamResult?.error?.message || 'Failed to get team information');
      }

      if (!teamResult?.data) {
        throw new Error('User is not part of any team');
      }

      setUserTeam(teamResult?.data);

      // Get current user's profile for header
      if (authUser?.id) {
        const { data: profile, error: profileError } = await teamService?.getTeamMembers(teamResult?.data?.id);
        if (!profileError && profile) {
          const currentUserProfile = profile?.find(member => member?.user_profiles?.id === authUser?.id);
          if (currentUserProfile?.user_profiles) {
            setUserProfile({
              name: currentUserProfile?.user_profiles?.full_name,
              email: currentUserProfile?.user_profiles?.email,
              role: currentUserProfile?.user_profiles?.role || 'Member'
            });
          }
        }
      }

      // Then fetch locations for this team
      const result = await locationService?.getTeamLocations(teamResult?.data?.id);
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to load team locations');
      }

      setLocations(result?.data || []);
    } catch (error) {
      console.error('Error loading team data:', error?.message);
      // You might want to show a toast or set an error state here
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filtered = [...locations];

    // Search filter - search across location names, addresses, restaurant names
    if (searchTerm) {
      filtered = filtered?.filter(location => {
        const locationMatch = location?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          location?.address?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          location?.notes?.toLowerCase()?.includes(searchTerm?.toLowerCase());

        const addressMatch = location?.location_addresses?.some(addr => 
          addr?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          addr?.address?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          addr?.notes?.toLowerCase()?.includes(searchTerm?.toLowerCase())
        );

        const restaurantMatch = location?.restaurants?.some(restaurant =>
          restaurant?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          restaurant?.cuisine_type?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
          restaurant?.notes?.toLowerCase()?.includes(searchTerm?.toLowerCase())
        );

        return locationMatch || addressMatch || restaurantMatch;
      });
    }

    // Location type filter
    if (locationTypeFilter !== 'all') {
      filtered = filtered?.filter(location => location?.location_type === locationTypeFilter);
    }

    setFilteredLocations(filtered);
  };

  const toggleLocationExpansion = (locationId) => {
    setExpandedLocations(prev => ({
      ...prev,
      [locationId]: !prev?.[locationId]
    }));
  };

  const expandAllLocations = () => {
    const allExpanded = {};
    filteredLocations?.forEach(location => {
      allExpanded[location?.id] = true;
    });
    setExpandedLocations(allExpanded);
  };

  const collapseAllLocations = () => {
    setExpandedLocations({});
  };

  const handleAddLocation = async (locationData) => {
    try {
      if (!userTeam?.id) {
        throw new Error('Team information not available');
      }

      const newLocationData = {
        ...locationData,
        team_id: userTeam?.id
      };

      const result = await locationService?.createLocation(newLocationData);
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to create location');
      }

      // Reload team data to get updated locations
      await loadTeamData();
      setShowAddLocationModal(false);
      return { success: true };
    } catch (error) {
      console.error('Error adding location:', error?.message);
      return { success: false, message: error?.message };
    }
  };

  const handleEditLocation = (location) => {
    setSelectedLocation(location);
    setShowEditLocationModal(true);
  };

  const handleUpdateLocation = async (locationData) => {
    if (!selectedLocation?.id) return;

    try {
      const result = await locationService?.updateLocation(selectedLocation?.id, locationData);
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to update location');
      }

      // Reload team data to get updated locations
      await loadTeamData();
      setShowEditLocationModal(false);
      setSelectedLocation(null);
      return { success: true };
    } catch (error) {
      console.error('Error updating location:', error?.message);
      return { success: false, message: error?.message };
    }
  };

  const handleDeleteLocation = async (location) => {
    if (confirm(`Are you sure you want to delete "${location?.name}"? This will also remove all addresses and restaurants for this location.`)) {
      try {
        const result = await locationService?.deleteLocation(location?.id);
        
        if (result?.error) {
          throw new Error(result?.error?.message || 'Failed to delete location');
        }

        // Reload team data to get updated locations
        await loadTeamData();
      } catch (error) {
        console.error('Error deleting location:', error?.message);
      }
    }
  };

  const handleAddLocationAddress = async (addressData) => {
    try {
      const result = await locationService?.createLocationAddress(addressData);
      
      if (result?.success) {
        await loadTeamData();
        setShowAddLocationAddressModal(false);
        setSelectedLocationForAddress(null);
        return { success: true };
      } else {
        return { success: false, message: result?.error?.message || 'Failed to add address' };
      }
    } catch (error) {
      console.error('Error adding location address:', error?.message);
      return { success: false, message: 'An unexpected error occurred' };
    }
  };

  const handleEditLocationAddress = (address) => {
    // TODO: Implement edit address modal
    console.log('Edit address:', address);
  };

  const handleDeleteLocationAddress = async (address) => {
    if (confirm(`Are you sure you want to delete "${address?.name}"?`)) {
      try {
        const result = await locationService?.deleteLocationAddress(address?.id);
        
        if (!result?.error) {
          await loadTeamData();
        } else {
          console.error('Error deleting address:', result?.error?.message);
        }
      } catch (error) {
        console.error('Error deleting address:', error?.message);
      }
    }
  };

  const handleSetPrimaryAddress = async (locationId, addressId) => {
    try {
      const result = await locationService?.setPrimaryAddress(locationId, addressId);
      
      if (!result?.error) {
        await loadTeamData();
      } else {
        console.error('Error setting primary address:', result?.error?.message);
      }
    } catch (error) {
      console.error('Error setting primary address:', error?.message);
    }
  };

  const handleAddRestaurant = async (restaurantData) => {
    try {
      const result = await locationService?.createRestaurant(restaurantData);
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to create restaurant');
      }

      // Reload team data to get updated restaurants
      await loadTeamData();
      setShowAddRestaurantModal(false);
      setSelectedLocation(null);
      return { success: true };
    } catch (error) {
      console.error('Error adding restaurant:', error?.message);
      return { success: false, message: error?.message };
    }
  };

  const handleToggleFavoriteRestaurant = async (restaurant) => {
    try {
      const result = await locationService?.updateRestaurant(restaurant?.id, {
        is_favorite: !restaurant?.is_favorite
      });
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to update restaurant');
      }

      // Reload team data to get updated restaurants
      await loadTeamData();
    } catch (error) {
      console.error('Error toggling favorite restaurant:', error?.message);
    }
  };

  const handleToggleRestaurantTag = async (restaurant, tagType) => {
    try {
      const result = await locationService?.updateRestaurant(restaurant?.id, {
        [tagType]: !restaurant?.[tagType]
      });
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to update restaurant');
      }

      // Reload team data to get updated restaurants
      await loadTeamData();
    } catch (error) {
      console.error('Error toggling restaurant tag:', error?.message);
    }
  };

  const handleUpdateRestaurantNotes = async (restaurant, notes) => {
    try {
      const result = await locationService?.updateRestaurant(restaurant?.id, { notes });
      
      if (result?.error) {
        throw new Error(result?.error?.message || 'Failed to update restaurant notes');
      }

      // Reload team data to get updated restaurants
      await loadTeamData();
    } catch (error) {
      console.error('Error updating restaurant notes:', error?.message);
    }
  };

  const handleExportLocations = () => {
    // Enhanced export with nested data
    const csvContent = [
      ['Location Name', 'Location Type', 'Main Address', 'Location Notes', 'Address Name', 'Address Type', 'Address', 'Address Notes', 'Restaurant Name', 'Cuisine Type', 'Phone', 'Favorite', 'Catering', 'Restaurant Notes'],
    ];

    filteredLocations?.forEach(location => {
      const addresses = location?.location_addresses || [];
      const restaurants = location?.restaurants || [];
      
      if (addresses?.length === 0 && restaurants?.length === 0) {
        // Location only
        csvContent?.push([
          location?.name || '',
          location?.location_type || '',
          location?.address || '',
          location?.notes || '',
          '', '', '', '', '', '', '', '', '', ''
        ]);
      } else {
        // Process addresses
        if (addresses?.length > 0) {
          addresses?.forEach(address => {
            csvContent?.push([
              location?.name || '',
              location?.location_type || '',
              location?.address || '',
              location?.notes || '',
              address?.name || '',
              address?.address_type || '',
              address?.address || '',
              address?.notes || '',
              '', '', '', '', '', ''
            ]);
          });
        }
        
        // Process restaurants
        if (restaurants?.length > 0) {
          restaurants?.forEach(restaurant => {
            csvContent?.push([
              location?.name || '',
              location?.location_type || '',
              location?.address || '',
              location?.notes || '',
              '', '', '', '',
              restaurant?.name || '',
              restaurant?.cuisine_type || '',
              restaurant?.phone || '',
              restaurant?.is_favorite ? 'Yes' : 'No',
              restaurant?.supports_catering ? 'Yes' : 'No',
              restaurant?.notes || ''
            ]);
          });
        }
      }
    });

    const csv = csvContent?.map(row => row?.join(','))?.join('\n');
    downloadCSV(csv, `locations-complete-${new Date()?.toISOString()?.split('T')?.[0]}.csv`);
  };

  const downloadCSV = (csvContent, filename) => {
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link?.click();
    URL.revokeObjectURL(url);
  };

  // Calculate statistics
  const locationStats = {
    total: locations?.length || 0,
    byType: {
      school: locations?.filter(l => l?.location_type === 'school')?.length || 0,
      hotel: locations?.filter(l => l?.location_type === 'hotel')?.length || 0,
      gym: locations?.filter(l => l?.location_type === 'gym')?.length || 0,
      venue: locations?.filter(l => l?.location_type === 'venue')?.length || 0,
      other: locations?.filter(l => l?.location_type === 'other')?.length || 0,
    },
    addresses: locations?.reduce((acc, loc) => acc + (loc?.location_addresses?.length || 0), 0) || 0,
    restaurants: locations?.reduce((acc, loc) => acc + (loc?.restaurants?.length || 0), 0) || 0
  };

  const restaurantStats = {
    favorites: locations?.reduce((acc, loc) => 
      acc + (loc?.restaurants?.filter(r => r?.is_favorite)?.length || 0), 0) || 0,
    catering: locations?.reduce((acc, loc) => 
      acc + (loc?.restaurants?.filter(r => r?.supports_catering)?.length || 0), 0) || 0,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header user={userProfile || { name: "Loading...", email: "", role: "" }} notifications={2} />
        <main className="pt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-muted-foreground mt-2">Loading locations...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile || { name: "Team Member", email: authUser?.email || "", role: "Member" }} notifications={2} />
      <main className="pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">Locations & Addresses</h1>
              <p className="text-muted-foreground">
                Manage your team's delivery locations with multiple addresses and preferred restaurants
              </p>
              {userTeam && (
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <Icon name="Users" size={14} />
                    <span>{userTeam?.name}</span>
                  </span>
                  <span>•</span>
                  <span>{locationStats?.total} locations</span>
                  <span>•</span>
                  <span>{locationStats?.addresses} addresses</span>
                  <span>•</span>
                  <span>{locationStats?.restaurants} restaurants</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <Button
                variant="outline"
                onClick={handleExportLocations}
                iconName="Download"
                iconPosition="left"
              >
                Export All
              </Button>
              <Button
                onClick={() => setShowAddLocationModal(true)}
                iconName="Plus"
                iconPosition="left"
              >
                Add Location
              </Button>
            </div>
          </div>

          {/* Enhanced Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Total Locations</p>
                  <p className="text-2xl font-bold text-foreground">{locationStats?.total}</p>
                </div>
                <Icon name="MapPin" size={24} className="text-primary" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Saved Addresses</p>
                  <p className="text-2xl font-bold text-foreground">{locationStats?.addresses}</p>
                </div>
                <Icon name="Navigation" size={24} className="text-blue-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Restaurants</p>
                  <p className="text-2xl font-bold text-foreground">{locationStats?.restaurants}</p>
                </div>
                <Icon name="Store" size={24} className="text-green-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Favorites</p>
                  <p className="text-2xl font-bold text-foreground">{restaurantStats?.favorites}</p>
                </div>
                <Icon name="Heart" size={24} className="text-red-600" />
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-6 shadow-athletic">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm">Catering Available</p>
                  <p className="text-2xl font-bold text-foreground">{restaurantStats?.catering}</p>
                </div>
                <Icon name="Truck" size={24} className="text-amber-600" />
              </div>
            </div>
          </div>

          {/* Search, Filters, and Bulk Actions */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-athletic mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-1 items-center space-x-4">
                <div className="relative flex-1 max-w-md">
                  <Icon name="Search" size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search locations, addresses, and restaurants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e?.target?.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={locationTypeFilter}
                  onChange={(value) => setLocationTypeFilter(value)}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'school', label: 'School' },
                    { value: 'hotel', label: 'Hotel' },
                    { value: 'gym', label: 'Gym' },
                    { value: 'venue', label: 'Venue' },
                    { value: 'other', label: 'Other' },
                  ]}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={expandAllLocations}
                  iconName="ChevronDown"
                  iconPosition="left"
                >
                  Expand All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={collapseAllLocations}
                  iconName="ChevronUp"
                  iconPosition="left"
                >
                  Collapse All
                </Button>
              </div>
            </div>
          </div>

          {/* Enhanced Locations with Nested Structure */}
          <div className="space-y-6">
            {filteredLocations?.map((location) => (
              <LocationCard
                key={location?.id}
                location={location}
                expanded={expandedLocations?.[location?.id]}
                onToggleExpansion={() => toggleLocationExpansion(location?.id)}
                onEdit={() => handleEditLocation(location)}
                onDelete={() => handleDeleteLocation(location)}
                onToggleFavoriteRestaurant={handleToggleFavoriteRestaurant}
                onToggleRestaurantTag={handleToggleRestaurantTag}
                onUpdateRestaurantNotes={handleUpdateRestaurantNotes}
                onAddRestaurant={() => {
                  setSelectedLocation(location);
                  setShowAddRestaurantModal(true);
                }}
                onAddAddress={(location) => {
                  setSelectedLocationForAddress(location);
                  setShowAddLocationAddressModal(true);
                }}
                onEditAddress={handleEditLocationAddress}
                onDeleteAddress={handleDeleteLocationAddress}
                onSetPrimaryAddress={handleSetPrimaryAddress}
              />
            ))}
          </div>

          {/* Empty State */}
          {filteredLocations?.length === 0 && (
            <div className="text-center py-16 bg-card border border-border rounded-lg shadow-athletic">
              <div className="max-w-md mx-auto">
                <Icon name="MapPin" size={48} className="text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {locations?.length === 0 ? 'No locations yet' : 'No locations found'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || locationTypeFilter !== 'all' ? 'Try adjusting your search terms or filters to find what you\'re looking for.' 
                    : 'Create your first location to start organizing addresses and restaurants for your team deliveries.'}
                </p>
                {!searchTerm && locationTypeFilter === 'all' && locations?.length === 0 && (
                  <div className="space-y-4">
                    <Button
                      onClick={() => setShowAddLocationModal(true)}
                      iconName="Plus"
                      iconPosition="left"
                      size="lg"
                    >
                      Add Your First Location
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Each location can have multiple delivery addresses and preferred restaurants
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Tips */}
          {locations?.length > 0 && (
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Icon name="Lightbulb" size={20} className="text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-1">Pro Tips</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Click the expand button on any location to manage its addresses and restaurants</li>
                    <li>• Set primary addresses to ensure deliveries go to the right entrance</li>
                    <li>• Mark restaurants as favorites or catering-enabled for quick filtering during order planning</li>
                    <li>• Use the search to quickly find locations, specific addresses, or restaurants across all locations</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          {showAddLocationModal && (
            <AddLocationModal
              onClose={() => setShowAddLocationModal(false)}
              onAdd={handleAddLocation}
            />
          )}

          {showEditLocationModal && selectedLocation && (
            <EditLocationModal
              location={selectedLocation}
              onClose={() => {
                setShowEditLocationModal(false);
                setSelectedLocation(null);
              }}
              onUpdate={handleUpdateLocation}
            />
          )}

          {showAddRestaurantModal && (
            <AddRestaurantModal
              locations={locations}
              preSelectedLocation={selectedLocation}
              onClose={() => {
                setShowAddRestaurantModal(false);
                setSelectedLocation(null);
              }}
              onAdd={handleAddRestaurant}
            />
          )}

          {showAddLocationAddressModal && selectedLocationForAddress && (
            <AddLocationAddressModal
              location={selectedLocationForAddress}
              onClose={() => {
                setShowAddLocationAddressModal(false);
                setSelectedLocationForAddress(null);
              }}
              onAdd={handleAddLocationAddress}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default SavedAddressesLocations;