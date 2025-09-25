import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Header from '../../components/ui/Header';
import { useAuth } from '../../contexts';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/custom/Button';
import Input from '../../components/ui/custom/Input';
import Select from '../../components/ui/custom/Select';
import Icon from '../../components/AppIcon';
import {
  ensurePlacesLib,
  newSessionToken,
  fetchAddressSuggestions,
  getPlaceDetailsFromPrediction,
  geocodeAddress,
} from '@/utils/googlePlaces';
import { cn } from '@/utils/cn';

const toTitleCase = (value = '') =>
  value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

const formatPhoneNumber = (value = '') => {
  const rawDigits = value.replace(/\D/g, '');
  if (!rawDigits) return '';

  const hasCountryCode = rawDigits.length > 10 && rawDigits.startsWith('1');
  const digits = hasCountryCode ? rawDigits.slice(1, 11) : rawDigits.slice(0, 10);

  if (!digits) return `+${rawDigits}`;

  if (digits.length < 4) {
    return hasCountryCode ? `+1 ${digits}` : digits;
  }

  if (digits.length < 7) {
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return hasCountryCode ? `+1 ${formatted}` : formatted;
  }

  const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return hasCountryCode ? `+1 ${formatted}` : formatted;
};

const addressKindOptions = [
  { value: 'main', label: 'Main Facility' },
  { value: 'practice', label: 'Practice Facility' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'other', label: 'Other' },
];

const addressSideOptions = [
  { value: 'home', label: 'Home' },
  { value: 'away', label: 'Away' },
  { value: 'neutral', label: 'Neutral' },
];

const initialAddressForm = {
  addressKind: 'main',
  addressSide: 'home',
  addressName: '',
  deliveryNotes: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  tripId: '',
  newTripName: '',
};

const initialTripForm = {
  tripName: '',
};

const PlacesAutocompleteInput = ({ value, onValueChange, onPlaceSelected, disabled }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const placesReadyRef = useRef(false);
  const sessionTokenRef = useRef(null);

  const ensurePlacesSession = useCallback(async () => {
    if (typeof window === 'undefined') return false;
    try {
      if (!placesReadyRef.current) {
        await ensurePlacesLib();
        placesReadyRef.current = true;
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = await newSessionToken();
      }
      return true;
    } catch (error) {
      console.error('Failed to initialise Google Places', error);
      return false;
    }
  }, []);

  const resetSessionToken = useCallback(async () => {
    try {
      sessionTokenRef.current = await newSessionToken();
    } catch (error) {
      console.error('Failed to refresh session token', error);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  useEffect(() => {
    const query = value?.trim();
    if (!open || !query || query.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const ready = await ensurePlacesSession();
      if (!ready || !sessionTokenRef.current) {
        setLoading(false);
        return;
      }

      try {
        const results = await fetchAddressSuggestions(query, sessionTokenRef.current);
        setSuggestions(results);
        setHighlightIndex(0);
      } catch (error) {
        console.error('Failed to load address suggestions', error);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, [value, open, ensurePlacesSession]);

  const handleSelectSuggestion = useCallback(async (suggestion) => {
    try {
      const ready = await ensurePlacesSession();
      if (!ready) return;

      const details = await getPlaceDetailsFromPrediction(suggestion.raw?.placePrediction, [
        'id',
        'formattedAddress',
        'location',
      ]);

      if (!details) return;

      const formatted = details.formattedAddress || suggestion.label || '';
      const coords = details.location ? { lat: details.location.lat, lng: details.location.lng } : null;

      onValueChange(formatted);
      onPlaceSelected({
        placeId: details.id || null,
        formattedAddress: formatted,
        location: coords,
      });

      setSuggestions([]);
      setOpen(false);
    } catch (error) {
      console.error('Failed to pick suggestion', error);
    } finally {
      await resetSessionToken();
    }
  }, [ensurePlacesSession, onPlaceSelected, onValueChange, resetSessionToken]);

  const handleInputFocus = useCallback(async () => {
    setOpen(true);
    await ensurePlacesSession();
  }, [ensurePlacesSession]);

  const handleKeyDown = useCallback((event) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }

    if (!open || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      const current = suggestions[highlightIndex];
      if (current) {
        event.preventDefault();
        handleSelectSuggestion(current);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }, [handleSelectSuggestion, highlightIndex, open, suggestions]);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-medium text-foreground">Address</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onFocus={handleInputFocus}
          onChange={(event) => {
            onValueChange(event.target.value);
            onPlaceSelected(null);
            if (!open) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Search for an address"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
        />
        {(open && (suggestions.length > 0 || loading)) && (
          <div className="absolute z-40 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
            <div className="max-h-56 overflow-auto py-1 text-sm">
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelectSuggestion(suggestion);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left hover:bg-muted',
                    index === highlightIndex && 'bg-muted'
                  )}
                >
                  {suggestion.label}
                </button>
              ))}
              {loading && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
              )}
              {!loading && suggestions.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches found</div>
              )}
            </div>
            <div className="border-t border-border bg-muted/30 px-3 py-1.5 flex justify-end">
              <img
                src="https://storage.googleapis.com/geo-devrel-public-buckets/powered_by_google_on_white.png"
                alt="Powered by Google"
                className="h-4"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SavesPage = () => {
  const { user, activeTeam, loadingTeams } = useAuth();
  const [activeTab, setActiveTab] = useState('addresses');

  const [locations, setLocations] = useState([]);
  const [trips, setTrips] = useState([]);

  const [loadingLocations, setLoadingLocations] = useState(true);
  const [loadingTrips, setLoadingTrips] = useState(true);

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [tripModalOpen, setTripModalOpen] = useState(false);

  const [addressForm, setAddressForm] = useState(initialAddressForm);
  const [addressInput, setAddressInput] = useState('');
  const [placeDetails, setPlaceDetails] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);
  const [savingLocation, setSavingLocation] = useState(false);

  const [tripForm, setTripForm] = useState(initialTripForm);
  const [editingTrip, setEditingTrip] = useState(null);
  const [savingTrip, setSavingTrip] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const resetAddressForm = useCallback(() => {
    setAddressForm(initialAddressForm);
    setAddressInput('');
    setPlaceDetails(null);
    setEditingLocation(null);
  }, []);

  const resetTripForm = useCallback(() => {
    setTripForm(initialTripForm);
    setEditingTrip(null);
  }, []);

  const fetchTrips = useCallback(async () => {
    if (!activeTeam?.id) {
      setTrips([]);
      setLoadingTrips(false);
      return;
    }
    setLoadingTrips(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('saved_trips')
        .select('*')
        .eq('team_id', activeTeam.id)
        .order('trip_name', { ascending: true });
      if (fetchError) throw fetchError;
      setTrips(data || []);
    } catch (fetchError) {
      console.error('Failed to load trips', fetchError);
      setError(fetchError.message || 'Failed to load trips');
    } finally {
      setLoadingTrips(false);
    }
  }, [activeTeam?.id]);

  const fetchLocations = useCallback(async () => {
    if (!activeTeam?.id) {
      setLocations([]);
      setLoadingLocations(false);
      return;
    }

    setLoadingLocations(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('team_id', activeTeam.id)
        .order('address_name', { ascending: true });

      if (fetchError) throw fetchError;

      const normalized = (data || []).map((row) => ({
        ...row,
        latitude: row?.latitude != null ? Number(row.latitude) : null,
        longitude: row?.longitude != null ? Number(row.longitude) : null,
      }));

      setLocations(normalized);
    } catch (fetchError) {
      console.error('Failed to load saved locations', fetchError);
      setError(fetchError.message || 'Failed to load saved locations');
    } finally {
      setLoadingLocations(false);
    }
  }, [activeTeam?.id]);

  useEffect(() => {
    if (loadingTeams) return;
    fetchTrips();
    fetchLocations();
  }, [fetchTrips, fetchLocations, loadingTeams]);

  useEffect(() => {
    if (!success) return undefined;
    const timer = setTimeout(() => setSuccess(''), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  const tripMap = useMemo(() => {
    const map = new Map();
    trips.forEach((trip) => map.set(trip.id, trip));
    return map;
  }, [trips]);

  const handleOpenAddressModal = () => {
    resetAddressForm();
    setAddressModalOpen(true);
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setAddressForm({
      addressKind: location.address_kind || 'main',
      addressSide: location.address_side || 'home',
      addressName: toTitleCase(location.address_name || ''),
      deliveryNotes: location.delivery_notes || '',
      contactName: toTitleCase(location.contact_name || ''),
      contactPhone: formatPhoneNumber(location.contact_phone || ''),
      contactEmail: location.contact_email || '',
      tripId: location.trip_id || '',
      newTripName: '',
    });
    setAddressInput(location.formatted_address || '');
    setPlaceDetails({
      placeId: location.google_place_id || null,
      formattedAddress: location.formatted_address || '',
      location:
        location.latitude != null && location.longitude != null
          ? { lat: Number(location.latitude), lng: Number(location.longitude) }
          : null,
    });
    setAddressModalOpen(true);
  };

  const handleDeleteLocation = async (location) => {
    if (!location?.id) return;
    const confirmed = window.confirm(`Delete saved address "${location.address_name}"?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      const { error: deleteError } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', location.id);
      if (deleteError) throw deleteError;

      setSuccess('Saved address deleted');
      if (editingLocation?.id === location.id) {
        resetAddressForm();
        setAddressModalOpen(false);
      }
      await fetchLocations();
    } catch (deleteError) {
      console.error('Failed to delete saved address', deleteError);
      setError(deleteError.message || 'Failed to delete saved address');
    }
  };

  const handleSubmitAddress = async (event) => {
    event.preventDefault();
    if (!activeTeam?.id) {
      setError('Select a team before saving addresses.');
      return;
    }

    const trimmedAddress = addressInput.trim();
    const trimmedName = toTitleCase(addressForm.addressName.trim());
    const contactName = toTitleCase(addressForm.contactName.trim());
    const contactPhone = addressForm.contactPhone.trim();
    const contactEmail = addressForm.contactEmail.trim();

    if (!trimmedAddress) {
      setError('Address is required.');
      return;
    }

    if (!trimmedName) {
      setError('Address name is required.');
      return;
    }

    setSavingLocation(true);
    setError('');
    setSuccess('');

    try {
      let coords = placeDetails?.location || null;
      if (!coords) {
        coords = await geocodeAddress(trimmedAddress);
      }

      const locationId =
        editingLocation?.location_id ||
        placeDetails?.placeId ||
        (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `loc_${Date.now()}`);

      let tripId = addressForm.tripId || null;
      const newTripName = toTitleCase((addressForm.newTripName || '').trim());
      let createdTripId = null;

      if (newTripName) {
        const existingTrip = trips.find((trip) => trip.trip_name?.toLowerCase() === newTripName.toLowerCase());
        if (existingTrip) {
          tripId = existingTrip.id;
        } else {
          const { data: insertedTrip, error: insertTripError } = await supabase
            .from('saved_trips')
            .insert({
              team_id: activeTeam.id,
              trip_name: newTripName,
              created_by: user?.id ?? null,
            })
            .select()
            .single();

          if (insertTripError) throw insertTripError;
          tripId = insertedTrip?.id || null;
          createdTripId = insertedTrip?.id || null;
        }
      }

      const payload = {
        team_id: activeTeam.id,
        address_kind: addressForm.addressKind,
        address_side: addressForm.addressSide,
        address_name: trimmedName,
        formatted_address: trimmedAddress,
        delivery_notes: addressForm.deliveryNotes.trim() || null,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        trip_id: tripId || null,
        location_id: locationId,
        google_place_id: placeDetails?.placeId || editingLocation?.google_place_id || null,
        latitude: coords?.lat ?? null,
        longitude: coords?.lng ?? null,
      };

      if (editingLocation?.id) {
        const { error: updateError } = await supabase
          .from('saved_locations')
          .update(payload)
          .eq('id', editingLocation.id);
        if (updateError) throw updateError;
        setSuccess('Saved address updated');
      } else {
        const { error: insertError } = await supabase
          .from('saved_locations')
          .insert({ ...payload, created_by: user?.id ?? null });
        if (insertError) throw insertError;
        setSuccess('Saved address added');
      }

      if (createdTripId) {
        await fetchTrips();
      }
      await fetchLocations();
      resetAddressForm();
      setAddressModalOpen(false);
    } catch (submitError) {
      console.error('Failed to save address', submitError);
      setError(submitError.message || 'Failed to save address');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleOpenTripModal = () => {
    resetTripForm();
    setTripModalOpen(true);
  };

  const handleEditTrip = (trip) => {
    setEditingTrip(trip);
    setTripForm({
      tripName: toTitleCase(trip.trip_name || ''),
    });
    setTripModalOpen(true);
  };

  const handleDeleteTrip = async (trip) => {
    if (!trip?.id) return;
    const confirmed = window.confirm(`Delete trip "${trip.trip_name}"? Saved locations assigned to this trip will remain.`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      const { error: deleteError } = await supabase
        .from('saved_trips')
        .delete()
        .eq('id', trip.id);
      if (deleteError) throw deleteError;

      setSuccess('Trip deleted');
      if (editingTrip?.id === trip.id) {
        resetTripForm();
        setTripModalOpen(false);
      }
      await fetchTrips();
      await fetchLocations();
    } catch (deleteError) {
      console.error('Failed to delete trip', deleteError);
      setError(deleteError.message || 'Failed to delete trip');
    }
  };

  const handleSubmitTrip = async (event) => {
    event.preventDefault();
    if (!activeTeam?.id) {
      setError('Select a team before managing trips.');
      return;
    }

    const trimmedName = tripForm.tripName.trim();
    if (!trimmedName) {
      setError('Trip name is required.');
      return;
    }

    setSavingTrip(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        team_id: activeTeam.id,
        trip_name: trimmedName,
      };

      if (editingTrip?.id) {
        const { error: updateError } = await supabase
          .from('saved_trips')
          .update(payload)
          .eq('id', editingTrip.id);
        if (updateError) throw updateError;
        setSuccess('Trip updated');
      } else {
        const { error: insertError } = await supabase
          .from('saved_trips')
          .insert({ ...payload, created_by: user?.id ?? null });
        if (insertError) throw insertError;
        setSuccess('Trip added');
      }

      await fetchTrips();
      await fetchLocations();
      resetTripForm();
      setTripModalOpen(false);
    } catch (submitError) {
      console.error('Failed to save trip', submitError);
      setError(submitError.message || 'Failed to save trip');
    } finally {
      setSavingTrip(false);
    }
  };

  const renderAddressCard = (location) => {
    const trip = location.trip_id ? tripMap.get(location.trip_id) : null;
    const kindLabel = addressKindOptions.find((option) => option.value === location.address_kind)?.label || location.address_kind;
    const sideLabel = addressSideOptions.find((option) => option.value === location.address_side)?.label || location.address_side;
    const contactSummaryParts = [];
    if (location.contact_name) contactSummaryParts.push(toTitleCase(location.contact_name));
    if (location.contact_phone) contactSummaryParts.push(formatPhoneNumber(location.contact_phone));
    if (location.contact_email) contactSummaryParts.push(location.contact_email);
    const contactSummary = contactSummaryParts.join(' | ');

    return (
      <div
        key={location.id}
        className="rounded-2xl border border-border/60 bg-gradient-to-br from-background to-muted/40 px-5 py-4 shadow-athletic-sm flex flex-col gap-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{sideLabel}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground">{kindLabel}</span>
              {trip && (
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{toTitleCase(trip.trip_name)}</span>
              )}
            </div>
            <h4 className="text-base font-semibold text-foreground">{toTitleCase(location.address_name)}</h4>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              iconName="Edit"
              onClick={() => handleEditLocation(location)}
              aria-label="Edit saved address"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-error hover:text-error"
              iconName="Trash2"
              onClick={() => handleDeleteLocation(location)}
              aria-label="Delete saved address"
            />
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Icon name="MapPin" size={14} className="mt-0.5 text-muted-foreground" />
            <span>{location.formatted_address}</span>
          </div>
          {location.delivery_notes && (
            <p className="text-sm leading-relaxed text-muted-foreground text-xs">
              <span className="font-semibold text-foreground text-xs">Delivery Notes:</span> {location.delivery_notes}</p>
          )}
          {contactSummary && (
            <p className="text-xs uppercase tracking-wide text-muted-foreground/90">
              <span className="font-semibold text-foreground">POC:</span> {contactSummary}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderTripCard = (trip) => {
    const linkedLocations = locations.filter((location) => location.trip_id === trip.id);
    return (
      <div key={trip.id} className="rounded-xl border border-border bg-card p-5 shadow-athletic-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-foreground">{toTitleCase(trip.trip_name)}</h4>
            {trip.description && (
              <p className="text-sm text-muted-foreground">{trip.description}</p>
            )}
            {trip.notes && (
              <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Notes:</span> {trip.notes}</p>
            )}
            <div className="text-xs text-muted-foreground">
              {linkedLocations.length === 0
                ? 'No addresses assigned yet.'
                : `${linkedLocations.length} address${linkedLocations.length === 1 ? '' : 'es'} assigned.`}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:flex-col sm:items-end">
            <Button variant="outline" size="sm" iconName="Edit" onClick={() => handleEditTrip(trip)}>
            </Button>
            <Button
              variant="outline"
              size="sm"
              iconName="Trash2"
              className="text-error hover:text-error"
              onClick={() => handleDeleteTrip(trip)}
            >
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const noTeamSelected = !activeTeam && !loadingTeams;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Saves</h1>
              <p className="text-sm text-muted-foreground mt-1">Manage saved addresses and trips for quick planning.</p>
            </div>
          </div>

          {noTeamSelected && (
            <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
              Select or create a team to start saving addresses and trips.
            </div>
          )}

          {!noTeamSelected && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 border-b border-border">
                {[
                  { id: 'addresses', label: 'Addresses' },
                  { id: 'trips', label: 'Trips' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              {activeTab === 'addresses' && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Saved addresses</h2>
                      <p className="text-sm text-muted-foreground">Store frequent destinations for quick reuse when scheduling meals.</p>
                    </div>
                    <Button iconName="Plus" iconPosition="left" onClick={handleOpenAddressModal}>
                      Add address
                    </Button>
                  </div>

                  {loadingLocations ? (
                    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                      Loading saved addresses…
                    </div>
                  ) : locations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      No saved addresses yet. Add a location to reuse it later.
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {locations.map(renderAddressCard)}
                    </div>
                  )}
                </section>
              )}

              {activeTab === 'trips' && (
                <section className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Trips</h2>
                      <p className="text-sm text-muted-foreground">Group destinations and favorite spots by school or region.</p>
                    </div>
                    <Button iconName="Plus" iconPosition="left" onClick={handleOpenTripModal}>
                      Add trip
                    </Button>
                  </div>

                  {loadingTrips ? (
                    <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                      Loading trips…
                    </div>
                  ) : trips.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                      No trips added yet. Create a trip to collect addresses and restaurants for recurring travel.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {trips.map(renderTripCard)}
                    </div>
                  )}
                </section>
              )}
            </div>
          )}
        </div>

        {addressModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            role="dialog"
            aria-modal="true"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setAddressModalOpen(false);
                resetAddressForm();
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-xl shadow-athletic w-full max-w-2xl p-6 space-y-6 overflow-y-auto max-h-[90vh]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{editingLocation ? 'Edit address' : 'Add address'}</h3>
                  {/* <p className="text-xs text-muted-foreground">Store a location for quick reuse.</p> */}
                </div>
                <Button variant="ghost" size="sm" iconName="X" onClick={() => { setAddressModalOpen(false); resetAddressForm(); }} />
              </div>

              <form className="space-y-6" onSubmit={handleSubmitAddress}>
                <section className="space-y-4">
                  <div>
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Location details</h4>
                    {/* <p className="text-sm text-muted-foreground">Help your team quickly recognise where this address fits in.</p> */}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Address kind"
                      value={addressForm.addressKind}
                      onChange={(value) => setAddressForm((prev) => ({ ...prev, addressKind: value || 'main' }))}
                      options={addressKindOptions}
                      selectedNoun="kinds"
                    />
                    <Select
                      label="Address side"
                      value={addressForm.addressSide}
                      onChange={(value) => setAddressForm((prev) => ({ ...prev, addressSide: value || 'home' }))}
                      options={addressSideOptions}
                      selectedNoun="sides"
                    />
                  </div>
                  <Input
                    label="Address name"
                    value={addressForm.addressName}
                    onChange={(event) => setAddressForm((prev) => ({ ...prev, addressName: toTitleCase(event.target.value) }))}
                    placeholder="e.g., Maples Pavilion"
                  />
                  <PlacesAutocompleteInput
                    value={addressInput}
                    onValueChange={setAddressInput}
                    onPlaceSelected={setPlaceDetails}
                    disabled={savingLocation}
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Point of Contact</h4>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Name"
                      value={addressForm.contactName}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, contactName: toTitleCase(event.target.value) }))}
                      placeholder="Person to reach on-site"
                    />
                    <Input
                      label="Phone"
                      type="tel"
                      value={addressForm.contactPhone}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, contactPhone: formatPhoneNumber(event.target.value) }))}
                      maxLength={17}
                      placeholder="(555) 123-4567"
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={addressForm.contactEmail}
                      onChange={(event) => setAddressForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                      placeholder="contact@example.com"
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Delivery Notes</h4>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <textarea
                    value={addressForm.deliveryNotes}
                    onChange={(event) => setAddressForm((prev) => ({ ...prev, deliveryNotes: event.target.value }))}
                    rows={3}
                    placeholder="e.g., Meet in front of the gym, Call when entering campus, etc.."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Trip association</h4>
                    <span className="text-xs text-muted-foreground">Optional</span>
                  </div>
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="flex-1">
                      <Select
                        label="Assign to trip"
                        value={addressForm.tripId}
                        onChange={(value) => setAddressForm((prev) => ({
                          ...prev,
                          tripId: value || '',
                          newTripName: value ? '' : prev.newTripName,
                        }))}
                        options={[{ value: '', label: 'No trip' }, ...trips.map((trip) => ({ value: trip.id, label: trip.trip_name }))]}
                        selectedNoun="trips"
                        placeholder="Select trip"
                      />
                    </div>
                    <div className="flex-1">
                      <Input
                        label="Or name new trip"
                        value={addressForm.newTripName}
                        onChange={(event) => setAddressForm((prev) => ({ ...prev, newTripName: toTitleCase(event.target.value), tripId: '' }))}
                        placeholder="e.g., San Diego or SDSU"
                      />
                    </div>
                  </div>
                </section>

                <div className="flex items-center justify-end">
                  <Button type="submit" loading={savingLocation} iconName={editingLocation ? 'Save' : 'Plus'} iconPosition="left">
                    {editingLocation ? 'Update address' : 'Add address'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {tripModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
            role="dialog"
            aria-modal="true"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setTripModalOpen(false);
                resetTripForm();
              }
            }}
          >
            <div
              className="bg-card border border-border rounded-xl shadow-athletic w-full max-w-md p-6 space-y-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{editingTrip ? 'Edit trip' : 'Add trip'}</h3>
                  <p className="text-sm text-muted-foreground">Group destinations and favorites for recurring travel.</p>
                </div>
                <Button variant="ghost" size="sm" iconName="X" onClick={() => { setTripModalOpen(false); resetTripForm(); }} />
              </div>

              <form className="space-y-4" onSubmit={handleSubmitTrip}>
                <Input
                  label="Trip name"
                  value={tripForm.tripName}
                  onChange={(event) => setTripForm((prev) => ({ ...prev, tripName: toTitleCase(event.target.value) }))}
                  placeholder="e.g., San Diego Trip"
                  required
                />
                <div className="flex items-center justify-end">
                  <Button type="submit" loading={savingTrip} iconName={editingTrip ? 'Save' : 'Plus'} iconPosition="left">
                    {editingTrip ? 'Update trip' : 'Add trip'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SavesPage;
