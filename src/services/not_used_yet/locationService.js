import { supabase } from '../../lib/supabase';

export const locationService = {
  async getTeamLocations(teamId) {
    try {
      const { data, error } = await supabase?.from('saved_locations')?.select(`
          *,
          location_addresses (
            id,
            name,
            address,
            address_type,
            notes,
            is_primary,
            created_at
          ),
          restaurants (
            id,
            name,
            cuisine_type,
            phone,
            is_favorite,
            supports_catering,
            notes
          )
        `)?.eq('team_id', teamId)?.order('name', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get team locations error:', error?.message);
      return { data: [], error };
    }
  },

  async createLocation(locationData) {
    try {
      const { data, error } = await supabase?.from('saved_locations')?.insert(locationData)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Create location error:', error?.message);
      return { data: null, error };
    }
  },

  async updateLocation(locationId, locationData) {
    try {
      const { data, error } = await supabase?.from('saved_locations')?.update(locationData)?.eq('id', locationId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update location error:', error?.message);
      return { data: null, error };
    }
  },

  async deleteLocation(locationId) {
    try {
      const { error } = await supabase?.from('saved_locations')?.delete()?.eq('id', locationId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete location error:', error?.message);
      return { error };
    }
  },

  async getRestaurantsByLocation(locationId) {
    try {
      const { data, error } = await supabase?.from('restaurants')?.select('*')?.eq('location_id', locationId)?.order('name', { ascending: true });

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get restaurants by location error:', error?.message);
      return { data: [], error };
    }
  },

  async createRestaurant(restaurantData) {
    try {
      const { data, error } = await supabase?.from('restaurants')?.insert(restaurantData)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Create restaurant error:', error?.message);
      return { data: null, error };
    }
  },

  async updateRestaurant(restaurantId, restaurantData) {
    try {
      const { data, error } = await supabase?.from('restaurants')?.update(restaurantData)?.eq('id', restaurantId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update restaurant error:', error?.message);
      return { data: null, error };
    }
  },

  async deleteRestaurant(restaurantId) {
    try {
      const { error } = await supabase?.from('restaurants')?.delete()?.eq('id', restaurantId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete restaurant error:', error?.message);
      return { error };
    }
  },

  async createLocationAddress(addressData) {
    try {
      const { data, error } = await supabase?.from('location_addresses')?.insert(addressData)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Create location address error:', error?.message);
      return { data: null, error };
    }
  },

  async updateLocationAddress(addressId, addressData) {
    try {
      const { data, error } = await supabase?.from('location_addresses')?.update(addressData)?.eq('id', addressId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Update location address error:', error?.message);
      return { data: null, error };
    }
  },

  async deleteLocationAddress(addressId) {
    try {
      const { error } = await supabase?.from('location_addresses')?.delete()?.eq('id', addressId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Delete location address error:', error?.message);
      return { error };
    }
  },

  async setPrimaryAddress(locationId, addressId) {
    try {
      // First, set all addresses for this location to non-primary
      await supabase?.from('location_addresses')?.update({ is_primary: false })?.eq('location_id', locationId);

      // Then set the selected address as primary
      const { data, error } = await supabase?.from('location_addresses')?.update({ is_primary: true })?.eq('id', addressId)?.select()?.single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Set primary address error:', error?.message);
      return { data: null, error };
    }
  },
};