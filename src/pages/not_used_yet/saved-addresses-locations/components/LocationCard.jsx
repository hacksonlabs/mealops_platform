import React, { useState } from 'react';
import Button from '../../../../components/ui/custom/Button';
import Input from '../../../../components/ui/custom/Input';
import Icon from '../../../../components/AppIcon';

const LocationCard = ({ 
  location, 
  expanded, 
  onToggleExpansion, 
  onEdit, 
  onDelete,
  onToggleFavoriteRestaurant,
  onToggleRestaurantTag,
  onUpdateRestaurantNotes,
  onAddRestaurant,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
  onSetPrimaryAddress
}) => {
  const [editingNotes, setEditingNotes] = useState({});

  const getLocationTypeIcon = (type) => {
    const icons = {
      school: 'GraduationCap',
      hotel: 'Building2',
      gym: 'Dumbbell',
      venue: 'Building',
      other: 'MapPin'
    };
    return icons?.[type] || 'MapPin';
  };

  const getLocationTypeBadge = (type) => {
    const typeConfig = {
      school: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'School' },
      hotel: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Hotel' },
      gym: { bg: 'bg-green-100', text: 'text-green-800', label: 'Gym' },
      venue: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Venue' },
      other: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Other' }
    };

    const config = typeConfig?.[type] || typeConfig?.other;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const getAddressTypeBadge = (type) => {
    const typeConfig = {
      school: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'School' },
      hotel: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Hotel' },
      gym: { bg: 'bg-green-50', text: 'text-green-700', label: 'Gym' },
      venue: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Venue' },
      other: { bg: 'bg-gray-50', text: 'text-gray-700', label: 'Other' }
    };

    const config = typeConfig?.[type] || typeConfig?.other;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${config?.bg} ${config?.text}`}>
        {config?.label}
      </span>
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString)?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleNotesEdit = (restaurantId, notes) => {
    setEditingNotes({ ...editingNotes, [restaurantId]: notes });
  };

  const handleNotesSave = (restaurant) => {
    const newNotes = editingNotes?.[restaurant?.id] || restaurant?.notes;
    onUpdateRestaurantNotes(restaurant, newNotes);
    setEditingNotes({ ...editingNotes, [restaurant?.id]: undefined });
  };

  const getRestaurantTags = (restaurant) => {
    const tags = [];
    if (restaurant?.is_favorite) {
      tags?.push({ label: 'Favorite', icon: 'Heart', color: 'text-red-600', bg: 'bg-red-100' });
    }
    if (restaurant?.is_past_used) {
      tags?.push({ label: 'Past Used', icon: 'Clock', color: 'text-blue-600', bg: 'bg-blue-100' });
    }
    if (restaurant?.supports_catering) {
      tags?.push({ label: 'Catering', icon: 'Truck', color: 'text-green-600', bg: 'bg-green-100' });
    }
    return tags;
  };

  const sortedAddresses = [...(location?.location_addresses || [])]?.sort((a, b) => {
    if (a?.is_primary && !b?.is_primary) return -1;
    if (!a?.is_primary && b?.is_primary) return 1;
    return a?.name?.localeCompare(b?.name);
  });

  const primaryAddress = location?.location_addresses?.find(addr => addr?.is_primary) || 
                        location?.location_addresses?.[0];

  return (
    <div className="bg-card border border-border rounded-lg shadow-athletic overflow-hidden">
      {/* Location Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name={getLocationTypeIcon(location?.location_type)} size={24} className="text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h3 className="text-xl font-semibold text-foreground">{location?.name}</h3>
                {getLocationTypeBadge(location?.location_type)}
              </div>
              <div className="flex items-start space-x-2">
                <Icon name="MapPin" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-sm text-foreground">
                    {primaryAddress?.address || location?.address}
                  </span>
                  {primaryAddress && (
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-muted-foreground">Primary:</span>
                      <span className="text-xs font-medium text-foreground">{primaryAddress?.name}</span>
                      {getAddressTypeBadge(primaryAddress?.address_type)}
                    </div>
                  )}
                </div>
              </div>
              {location?.notes && (
                <div className="flex items-start space-x-2 mt-2">
                  <Icon name="FileText" size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-muted-foreground">{location?.notes}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-right text-xs text-muted-foreground">
              <div>{(location?.location_addresses?.length || 0)} addresses</div>
              <div>{location?.restaurants?.length || 0} restaurants</div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleExpansion}
              iconName={expanded ? "ChevronUp" : "ChevronDown"}
              title={expanded ? "Collapse Details" : "Expand Details"}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onEdit}
              iconName="Edit"
              title="Edit Location"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              iconName="Trash2"
              title="Delete Location"
              className="text-red-600 hover:text-red-700"
            />
          </div>
        </div>
      </div>
      
      {/* Expanded Content (Addresses and Restaurants) */}
      {expanded && (
        <div className="p-6 bg-muted/20">
          <div className="space-y-6">
            {/* Addresses Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-foreground">Saved Addresses</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAddAddress(location)}
                  iconName="Plus"
                  iconPosition="left"
                >
                  Add Address
                </Button>
              </div>

              {sortedAddresses?.length > 0 ? (
                <div className="space-y-3 mb-6">
                  {sortedAddresses?.map((address) => (
                    <div key={address?.id} className="bg-card border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="font-semibold text-foreground">{address?.name}</h5>
                            {getAddressTypeBadge(address?.address_type)}
                            {address?.is_primary && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                <Icon name="Star" size={12} className="mr-1" />
                                Primary
                              </span>
                            )}
                          </div>
                          <div className="flex items-start space-x-2">
                            <Icon name="MapPin" size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-foreground">{address?.address}</span>
                          </div>
                          {address?.notes && (
                            <div className="flex items-start space-x-2 mt-2">
                              <Icon name="StickyNote" size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                              <span className="text-sm text-muted-foreground">{address?.notes}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {!address?.is_primary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onSetPrimaryAddress(location?.id, address?.id)}
                              iconName="Star"
                              title="Set as Primary"
                              className="text-muted-foreground hover:text-primary"
                            />
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditAddress(address)}
                            iconName="Edit"
                            title="Edit Address"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteAddress(address)}
                            iconName="Trash2"
                            title="Delete Address"
                            className="text-red-600 hover:text-red-700"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 mb-6">
                  <Icon name="MapPin" size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No additional addresses added yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddAddress(location)}
                    iconName="Plus"
                    iconPosition="left"
                    className="mt-2"
                  >
                    Add First Address
                  </Button>
                </div>
              )}
            </div>

            {/* Restaurants Section */}
            <div className="border-t border-border pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-foreground">Restaurants</h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddRestaurant}
                  iconName="Plus"
                  iconPosition="left"
                >
                  Add Restaurant
                </Button>
              </div>

              {location?.restaurants?.length > 0 ? (
                <div className="space-y-4">
                  {location?.restaurants?.map((restaurant) => (
                    <div key={restaurant?.id} className="bg-card border border-border rounded-lg p-4">
                      {/* Restaurant Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h5 className="font-semibold text-foreground">{restaurant?.name}</h5>
                            <div className="flex items-center space-x-2">
                              {getRestaurantTags(restaurant)?.map((tag, index) => (
                                <span key={index} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${tag?.bg} ${tag?.color}`}>
                                  <Icon name={tag?.icon} size={12} className="mr-1" />
                                  {tag?.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <div className="flex items-center space-x-1">
                              <Icon name="ChefHat" size={14} />
                              <span>{restaurant?.cuisine_type}</span>
                            </div>
                            {restaurant?.phone && (
                              <div className="flex items-center space-x-1">
                                <Icon name="Phone" size={14} />
                                <span>{restaurant?.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleFavoriteRestaurant(restaurant)}
                            iconName="Heart"
                            title="Toggle Favorite"
                            className={restaurant?.is_favorite ? "text-red-600" : "text-muted-foreground"}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onToggleRestaurantTag(restaurant, 'supports_catering')}
                            iconName="Truck"
                            title="Toggle Catering"
                            className={restaurant?.supports_catering ? "text-green-600" : "text-muted-foreground"}
                          />
                        </div>
                      </div>

                      {/* Notes Section */}
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Icon name="StickyNote" size={14} className="text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Notes:</span>
                        </div>
                        {editingNotes?.[restaurant?.id] !== undefined ? (
                          <div className="flex items-center space-x-2">
                            <Input
                              value={editingNotes?.[restaurant?.id]}
                              onChange={(e) => handleNotesEdit(restaurant?.id, e?.target?.value)}
                              placeholder="Add notes (e.g., 'Post-game usual')"
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNotesSave(restaurant)}
                              iconName="Check"
                              title="Save Notes"
                              className="text-green-600"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingNotes({ ...editingNotes, [restaurant?.id]: undefined })}
                              iconName="X"
                              title="Cancel"
                              className="text-red-600"
                            />
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-muted-foreground flex-1">
                              {restaurant?.notes || 'No notes added'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleNotesEdit(restaurant?.id, restaurant?.notes || '')}
                              iconName="Edit"
                              title="Edit Notes"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Icon name="Store" size={32} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No restaurants added to this location yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onAddRestaurant}
                    iconName="Plus"
                    iconPosition="left"
                    className="mt-2"
                  >
                    Add First Restaurant
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Location Footer */}
      <div className="px-6 py-3 bg-muted/10 border-t border-border">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-1">
            <Icon name="Calendar" size={12} />
            <span>Added {formatDate(location?.created_at)}</span>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              iconName="ExternalLink"
              title="View on Map"
              className="text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              iconName="Navigation"
              title="Get Directions"
              className="text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationCard;