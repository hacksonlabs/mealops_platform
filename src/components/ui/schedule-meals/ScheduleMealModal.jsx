// /src/components/ui/schedule-meals/ScheduleMealModal.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../AppIcon';
import Button from '../custom/Button';
import Input from '../custom/Input';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { cn } from '@/utils/cn';
import { getMealTypeIcon, MEAL_TYPES, SERVICE_TYPES } from '../../../utils/ordersUtils';
import {
  ensurePlacesLib, newSessionToken, fetchAddressSuggestions, getPlaceDetailsFromPrediction
} from '../../../utils/googlePlaces';
import { toTitleCase } from '@/utils/stringUtils';
import { useAuth } from '@/contexts';
import { supabase } from '@/lib/supabase';

const ScheduleMealModal = ({ isOpen, onClose, selectedDate, onSchedule, onSearchNearby }) => {
  const { activeTeam } = useAuth();
  // --- date helpers ---
  const pad = (n) => String(n).padStart(2, '0');
  const formatPhoneNumber = (value = '') => {
    const rawDigits = value.replace(/\D/g, '');
    if (!rawDigits) return '';

    const hasCountryCode = rawDigits.length > 10 && rawDigits.startsWith('1');
    const digits = hasCountryCode ? rawDigits.slice(1, 11) : rawDigits.slice(0, 10);

    if (!digits) return `+${rawDigits}`;
    if (digits.length < 4) return hasCountryCode ? `+1 ${digits}` : digits;
    if (digits.length < 7) {
      const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
      return hasCountryCode ? `+1 ${formatted}` : formatted;
    }
    const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    return hasCountryCode ? `+1 ${formatted}` : formatted;
  };
  const formatDateInputValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateFromInput = (s) => new Date(`${s}T00:00:00`);
  const prettyDate = (dateStr) =>
    dateStr
      ? dateFromInput(dateStr).toLocaleDateString('en-US', {
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        })
      : '';
  const toISOFromLocal = (dateStr, timeStr) =>
    new Date(`${dateStr}T${timeStr || '00:00'}`).toISOString();

  // --- core form state ---
  const [formData, setFormData] = useState({
    title: '',
    mealType: 'lunch',
    date: formatDateInputValue(selectedDate || new Date()),
    time: '12:00',
    serviceType: 'delivery', // default OK
  });

  // address/autocomplete state
  const [addressInput, setAddressInput] = useState('');
  const [pickedPlace, setPickedPlace] = useState(null); // { formattedAddress, location, id }
  const [locationMode, setLocationMode] = useState('custom'); // 'saved' | 'custom'
  const [savedLocations, setSavedLocations] = useState([]);
  const [loadingSavedLocations, setLoadingSavedLocations] = useState(false);
  const [savedLocationsError, setSavedLocationsError] = useState('');
  const [savedLocationQuery, setSavedLocationQuery] = useState('');
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState('');
  const [savedSuggestionsOpen, setSavedSuggestionsOpen] = useState(false);
  const [savedHighlightIndex, setSavedHighlightIndex] = useState(0);
  const savedInputWrapperRef = useRef(null);
  const savedSuggestionsPortalRef = useRef(null);
  const savedRectRef = useRef(null);
  const [savedRect, setSavedRect] = useState(null);

  const updateSavedRect = useCallback(() => {
    if (!savedInputWrapperRef.current) return;
    const rect = savedInputWrapperRef.current.getBoundingClientRect();
    savedRectRef.current = rect;
    setSavedRect({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  const filteredSavedLocations = useMemo(() => {
    const query = savedLocationQuery.trim().toLowerCase();
    if (!query) return savedLocations;
    return savedLocations.filter((location) => {
      const haystack = [
        location.address_name,
        location.formatted_address,
        location.address_kind,
        location.address_side,
        location.contact_name,
        location.contact_email,
        location.contact_phone,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [savedLocations, savedLocationQuery]);

  const savedSuggestions = useMemo(() => {
    if (locationMode !== 'saved') return [];
    const query = savedLocationQuery.trim();
    if (!query) return [];
    return filteredSavedLocations.slice(0, 8);
  }, [locationMode, filteredSavedLocations, savedLocationQuery]);

  const handleSelectSavedLocation = useCallback((location) => {
    if (!location) return;
    setSelectedSavedLocationId(location.id);
    setSavedLocationQuery(location.address_name || '');
    const formatted = location.formatted_address || '';
    const lat = location.latitude != null ? Number(location.latitude) : null;
    const lng = location.longitude != null ? Number(location.longitude) : null;

    setAddressInput(formatted);
    setPickedPlace({
      id: location.id,
      formattedAddress: formatted,
      location: lat != null && lng != null ? { lat, lng } : null,
    });
    setOpenAC(false);
    setSugs([]);
    setSavedSuggestionsOpen(false);
    const inputEl = savedInputWrapperRef.current?.querySelector('input');
    inputEl?.blur();
  }, []);

  const selectedSavedLocation = useMemo(
    () => savedLocations.find((loc) => loc.id === selectedSavedLocationId) || null,
    [savedLocations, selectedSavedLocationId]
  );

  // validation: address required for ALL methods
  const addressTyped = Boolean((pickedPlace?.formattedAddress || addressInput)?.trim());
  const hasFulfillment = Boolean(formData?.serviceType);
  const hasTitle = Boolean((formData.title || '').trim());
  const isValid = Boolean(
    formData?.date &&
      formData?.time &&
      formData?.mealType &&
      hasTitle &&
      hasFulfillment &&
      addressTyped 
  );

  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, date: formatDateInputValue(selectedDate) }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!isOpen) return;
    setLocationMode(savedLocations.length > 0 ? 'saved' : 'custom');
  }, [isOpen, savedLocations.length]);

  useEffect(() => {
    setSavedHighlightIndex(0);
  }, [savedSuggestions.length]);

  useEffect(() => {
    if (!savedSuggestionsOpen) {
      setSavedHighlightIndex(0);
    }
  }, [savedSuggestionsOpen]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!savedInputWrapperRef.current) return;
      if (!savedInputWrapperRef.current.contains(event.target)) {
        setSavedSuggestionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (locationMode !== 'saved') {
      setSavedSuggestionsOpen(false);
      return;
    }

    if (!savedLocationQuery.trim()) {
      setSavedSuggestionsOpen(false);
      return;
    }

    if (savedSuggestions.length === 0) {
      // keep panel open to show "No matches" message if user is typing
      return;
    }

    const inputEl = savedInputWrapperRef.current?.querySelector('input');
    if (document.activeElement === inputEl) {
      setSavedSuggestionsOpen(true);
    }
  }, [locationMode, savedLocationQuery, savedSuggestions.length]);

  useEffect(() => {
    if (!savedSuggestionsOpen) return;
    updateSavedRect();
    const handle = () => updateSavedRect();
    window.addEventListener('resize', handle);
    window.addEventListener('scroll', handle, true);
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, true);
    };
  }, [savedSuggestionsOpen, updateSavedRect]);

  useEffect(() => {
    if (locationMode === 'saved' && savedLocations.length === 0) {
      setLocationMode('custom');
    }
  }, [locationMode, savedLocations.length]);

  // Load saved locations for the active team when modal opens
  useEffect(() => {
    const loadSavedLocations = async () => {
      if (!isOpen || !activeTeam?.id) {
        setSavedLocations([]);
        return;
      }

      setLoadingSavedLocations(true);
      setSavedLocationsError('');
      try {
        const { data, error } = await supabase
          .from('saved_locations')
          .select(
            'id, address_name, formatted_address, address_kind, address_side, contact_name, contact_phone, contact_email, latitude, longitude, delivery_notes, trip_id'
          )
          .eq('team_id', activeTeam.id)
          .order('address_name', { ascending: true });

        if (error) throw error;

        const normalized = (data || []).map((item) => ({
          ...item,
          latitude: item?.latitude != null ? Number(item.latitude) : null,
          longitude: item?.longitude != null ? Number(item.longitude) : null,
        }));

        setSavedLocations(normalized);
      } catch (savedError) {
        console.error('Failed to load saved locations', savedError);
        setSavedLocationsError(savedError.message || 'Failed to load saved addresses');
        setSavedLocations([]);
      } finally {
        setLoadingSavedLocations(false);
      }
    };

    loadSavedLocations();
  }, [isOpen, activeTeam?.id]);

  // --- Places lib + session token refs ---
  const placesReadyRef = useRef(false);
  const sessionTokenRef = useRef(null);

  // Suggestions UI state
  const [openAC, setOpenAC] = useState(false);
  const [loadingAC, setLoadingAC] = useState(false);
  const [sugs, setSugs] = useState([]); // array of { id, label, raw }
  const [hi, setHi] = useState(0);
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Portal positioning for suggestions
  const acPortalRef = useRef(null);
  const [acRect, setAcRect] = useState(null); // { top, left, width, bottom }
  const updateAcPosition = () => {
    if (!wrapperRef.current) return;
    const r = wrapperRef.current.getBoundingClientRect();
    setAcRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });
  };

  // Load library + session token when modal opens
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isOpen) return;
      await ensurePlacesLib();
      if (!mounted) return;
      placesReadyRef.current = true;
      sessionTokenRef.current = await newSessionToken();
    })();
    return () => { mounted = false; };
  }, [isOpen]);

  // Close suggestions when clicking outside (including the portal)
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapperRef.current) return;
      const insideInput = wrapperRef.current.contains(e.target);
      const insidePortal = acPortalRef.current?.contains(e.target);
      if (!insideInput && !insidePortal) setOpenAC(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Keep dropdown positioned on scroll/resize while open
  useEffect(() => {
    if (!openAC) return;
    updateAcPosition();
    const onScrollOrResize = () => updateAcPosition();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true); // capture scrolls in nested containers
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [openAC]);

  // Fetch predictions (debounced)
  useEffect(() => {
    if (!isOpen || !placesReadyRef.current || locationMode !== 'custom') {
      if (locationMode !== 'custom') {
        setLoadingAC(false);
        setSugs([]);
      }
      return;
    }
    const q = addressInput?.trim();
    if (!q || q.length < 3) {
      setSugs([]);
      setLoadingAC(false);
      return;
    }
    setLoadingAC(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchAddressSuggestions(q, sessionTokenRef.current);
        setSugs(results);
        setHi(0);
        updateAcPosition();
      } catch {
        setSugs([]);
      } finally {
        setLoadingAC(false);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [addressInput, isOpen, locationMode]);

  const resetSessionToken = async () => {
    sessionTokenRef.current = await newSessionToken();
  };

  // Convert a suggestion to a Place and fetch details
  const selectSuggestion = async (sugg) => {
    try {
      const details = await getPlaceDetailsFromPrediction(sugg.raw?.placePrediction, [
        'id', 'formattedAddress', 'location',
      ]);
      if (!details) { setOpenAC(false); return; }
      setPickedPlace({
        id: details.id,
        formattedAddress: details.formattedAddress,
        location: details.location,
      });
      setAddressInput(details.formattedAddress || sugg.label || '');
      setOpenAC(false);
    } finally {
      await resetSessionToken();
    }
  };

  const onKeyDown = (e) => {
    if (locationMode !== 'custom') return;
    if (!openAC && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpenAC(true); updateAcPosition(); return; }
    if (!openAC || sugs.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, sugs.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      const s = sugs[hi];
      if (s) { e.preventDefault(); selectSuggestion(s); }
    } else if (e.key === 'Escape') { setOpenAC(false); }
  };

  const handleSavedKeyDown = useCallback((event) => {
    if (locationMode !== 'saved') return;
    if (!savedSuggestionsOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      if (savedSuggestions.length === 0) return;
      event.preventDefault();
      setSavedSuggestionsOpen(true);
      return;
    }

    if (!savedSuggestionsOpen || savedSuggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSavedHighlightIndex((prev) => Math.min(prev + 1, savedSuggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSavedHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selection = savedSuggestions[savedHighlightIndex];
      if (selection) {
        handleSelectSavedLocation(selection);
      }
    } else if (event.key === 'Escape') {
      setSavedSuggestionsOpen(false);
    }
  }, [locationMode, savedSuggestionsOpen, savedSuggestions, savedHighlightIndex, handleSelectSavedLocation]);

  // Submit
  const handleSubmit = (e) => {
    e?.preventDefault();

    const address = pickedPlace?.formattedAddress || addressInput || '';
    const coords  = pickedPlace?.location || null;
    const title = (formData.title || '').trim()
    const payload = {
      title: toTitleCase(title),
      mealType: formData.mealType,
      date: formData.date,               // YYYY-MM-DD
      time: formData.time,               // HH:mm
      serviceType: formData.serviceType, // 'delivery' | 'pickup'
      address,                           // user-entered (required for both)
      delivery_address: formData.serviceType === 'delivery' ? address : '',
      coords,                            // { lat, lng } | null
      whenISO: new Date(`${formData.date}T${formData.time}`).toISOString(),
    };

    onSchedule(payload);
    onClose();
    resetForm();
  };

  // Optional: hand off to parent to search nearby using coords/address
  const handleSearchNearby = () => {
    if (!onSearchNearby) return;
    onSearchNearby({
      address: pickedPlace?.formattedAddress || addressInput || '',
      coords: pickedPlace?.location || null,
      serviceType: formData?.serviceType,
      when: toISOFromLocal(formData?.date, formData?.time),
      mealType: formData?.mealType,
    });
  };

  const handleLocationModeChange = useCallback((mode) => {
    if (mode === 'saved' && savedLocations.length === 0) return;
    setLocationMode(mode);
    if (mode === 'saved') {
      const existing = savedLocations.find((loc) => loc.id === selectedSavedLocationId);
      if (existing) {
        handleSelectSavedLocation(existing);
      } else {
        setSelectedSavedLocationId('');
        setSavedLocationQuery('');
        setAddressInput('');
        setPickedPlace(null);
      }
      setSavedSuggestionsOpen(false);
    } else {
      setSelectedSavedLocationId('');
      setSavedLocationQuery('');
      setSavedSuggestionsOpen(false);
      setAddressInput('');
      setPickedPlace(null);
    }
  }, [savedLocations, selectedSavedLocationId, handleSelectSavedLocation]);

  useEffect(() => {
    if (locationMode !== 'custom') {
      setOpenAC(false);
      setSugs([]);
    }
  }, [locationMode]);

  const resetForm = () => {
    setFormData({
      mealType: 'lunch',
      date: formatDateInputValue(selectedDate || new Date()),
      time: '12:00',
      serviceType: 'delivery',
    });
    setAddressInput('');
    setPickedPlace(null);
    setSugs([]);
    setOpenAC(false);
    setSelectedSavedLocationId('');
    setSavedLocationQuery('');
    setSavedSuggestionsOpen(false);
    setLocationMode(savedLocations.length > 0 ? 'saved' : 'custom');
  };

  useEffect(() => {
    if (!selectedSavedLocationId) return;
    if (savedLocations.some((loc) => loc.id === selectedSavedLocationId)) return;
    setSelectedSavedLocationId('');
  }, [selectedSavedLocationId, savedLocations]);

  const handleBackdropClick = useCallback((event) => {
    if (event.target === event.currentTarget) {
      onClose?.();
    }
  }, [onClose]);

  const stopPropagation = useCallback((event) => {
    event.stopPropagation();
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal wrapper: give mobile screens breathing room without touching desktop layout */}
      <div
        className="relative z-10 flex min-h-full items-start justify-center px-4 py-6 sm:px-0 sm:py-12"
        onClick={handleBackdropClick}
      >
        <div
          className="w-full max-w-2xl bg-card border border-border rounded-xl shadow-athletic-lg max-h-[85vh] overflow-hidden flex flex-col"
          onClick={stopPropagation}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-border shrink-0">
            <div>
              <h2 className="text-xl font-heading font-semibold text-foreground">Schedule Meal</h2>
              <p className="text-sm text-muted-foreground mt-1">{prettyDate(formData?.date)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} iconName="X" iconSize={20} />
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Added pb-28 so there's space above the footer */}
            <form id="schedule-meal-form" onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Title */}
              <Input
                label="Meal Title"
                type="text"
                placeholder="e.g., SD Post Game"
                value={formData.title}
                maxLength={80}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e?.target?.value }))}
              />

              {/* Top grid: Meal Type | Date/Time + Fulfillment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Meal type — compact 2×2 */}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">Meal Type</div>
                  <div className="grid grid-cols-2 gap-2">
                    {MEAL_TYPES.map(({ value, label }) => {
                      const selected = formData?.mealType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, mealType: value }))}
                          aria-pressed={selected}
                          className={`w-full flex items-center gap-2 p-2.5 border rounded-md text-sm transition-athletic
                            ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                        >
                          <Icon name={getMealTypeIcon(value)} size={16} />
                          <span className="font-medium">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Date/Time + Fulfillment */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Date"
                      type="date"
                      value={formData?.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e?.target?.value }))}
                    />
                    <Input
                      label={(
                        <span className="inline-flex items-center">
                          Time
                          <InfoTooltip
                            text="To ensure on-time arrival, deliveries may arrive up to 15 minutes early."
                          />
                        </span>
                      )}
                      type="time"
                      value={formData?.time}
                      onChange={(e) => setFormData((prev) => ({ ...prev, time: e?.target?.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground">Fulfillment</div>
                    <div className="grid grid-cols-2 gap-2">
                      {SERVICE_TYPES.map(({ value, label, icon }) => {
                        const selected = formData?.serviceType === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, serviceType: value }))}
                            aria-pressed={selected}
                            className={`w-full flex items-center justify-center gap-2 p-2.5 border rounded-md text-sm transition-athletic
                              ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                          >
                            <Icon name={icon} size={16} />
                            <span className="font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium text-foreground">Location</span>
                    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 p-1 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => handleLocationModeChange('saved')}
                        disabled={!savedLocations.length}
                        className={cn(
                          'rounded-full px-3 py-1 transition-colors',
                          locationMode === 'saved'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                          !savedLocations.length && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        Saved
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLocationModeChange('custom')}
                        className={cn(
                          'rounded-full px-3 py-1 transition-colors',
                          locationMode === 'custom'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        Enter new
                      </button>
                    </div>
                  </div>
                  {onSearchNearby && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      iconName="Search"
                      onClick={handleSearchNearby}
                      disabled={!addressInput && !pickedPlace}
                    >
                      Search nearby
                    </Button>
                  )}
                </div>

                {locationMode === 'saved' ? (
                  <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                    {savedLocationsError && (
                      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {savedLocationsError}
                      </div>
                    )}

                    {loadingSavedLocations ? (
                      <div className="text-sm text-muted-foreground">Loading saved locations…</div>
                    ) : savedLocations.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border bg-background/60 px-3 py-6 text-center text-sm text-muted-foreground">
                        No saved addresses yet. Add one from the Saves tab to reuse it here.
                      </div>
                    ) : (
                      <>
                        <div className="relative" ref={savedInputWrapperRef}>
                          <Input
                            type="search"
                            placeholder="Start typing to search saved locations"
                            value={savedLocationQuery}
                            onChange={(event) => {
                              const value = event.target.value;
                              setSavedLocationQuery(value);
                              const shouldOpen = Boolean(value.trim());
                              setSavedSuggestionsOpen(shouldOpen);
                              setSavedHighlightIndex(0);
                            }}
                            onFocus={() => {
                              if (savedLocationQuery.trim() && savedSuggestions.length > 0) {
                                setSavedSuggestionsOpen(true);
                              }
                            }}
                            onKeyDown={handleSavedKeyDown}
                          />

                          {savedSuggestionsOpen && savedRect &&
                            createPortal(
                              <div
                                ref={savedSuggestionsPortalRef}
                                style={{
                                  position: 'fixed',
                                  top: savedRect.top,
                                  left: savedRect.left,
                                  width: savedRect.width,
                                  zIndex: 100000,
                                }}
                                className="max-h-60 overflow-auto rounded-xl border border-border bg-popover shadow-athletic-lg"
                              >
                                {savedSuggestions.length === 0 ? (
                                  <div className="px-3 py-2 text-sm text-muted-foreground">No matches found</div>
                                ) : (
                                  savedSuggestions.map((location, index) => {
                                    const isActive = index === savedHighlightIndex;
                                    const contactSummaryParts = [
                                      location.contact_name ? toTitleCase(location.contact_name) : null,
                                      location.contact_phone ? formatPhoneNumber(location.contact_phone) : null,
                                      location.contact_email || null,
                                    ].filter(Boolean);

                                    return (
                                      <button
                                        type="button"
                                        key={location.id}
                                        className={cn(
                                          'w-full text-left px-3 py-2 text-sm transition-colors',
                                          isActive ? 'bg-primary/10 text-primary' : 'hover:bg-muted/40'
                                        )}
                                        onMouseDown={(event) => {
                                          event.preventDefault();
                                          handleSelectSavedLocation(location);
                                        }}
                                      >
                                        <div className="font-medium text-foreground">{toTitleCase(location.address_name)}</div>
                                        <div className="text-xs text-muted-foreground">{location.formatted_address}</div>
                                        {contactSummaryParts.length > 0 && (
                                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground/70">
                                            POC: {contactSummaryParts.join(' | ')}
                                          </div>
                                        )}
                                      </button>
                                    );
                                  })
                                )}
                              </div>,
                              document.body
                            )}
                        </div>

                        {/* {!savedLocationQuery.trim() && (
                          <div className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                            Start typing above to find a saved location.
                          </div>
                        )} */}

                        {selectedSavedLocation && (
                          <div className="rounded-xl border border-border/60 bg-background/70 px-4 py-4 space-y-2 text-sm text-muted-foreground">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <span className="rounded-full bg-muted/60 px-2 py-0.5">{toTitleCase(selectedSavedLocation.address_side || '')}</span>
                              <span className="rounded-full bg-muted/60 px-2 py-0.5">{toTitleCase(selectedSavedLocation.address_kind || '')}</span>
                            </div>
                            <p className="text-base font-semibold text-foreground">{toTitleCase(selectedSavedLocation.address_name)}</p>
                            <div className="flex items-start gap-2 text-sm text-muted-foreground">
                              <Icon name="MapPin" size={14} className="mt-0.5 text-muted-foreground" />
                              <span>{selectedSavedLocation.formatted_address}</span>
                            </div>
                            {selectedSavedLocation.delivery_notes && (
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Notes:</span> {selectedSavedLocation.delivery_notes}
                              </p>
                            )}
                            {(() => {
                              const contactSummaryParts = [
                                selectedSavedLocation.contact_name ? toTitleCase(selectedSavedLocation.contact_name) : null,
                                selectedSavedLocation.contact_phone ? formatPhoneNumber(selectedSavedLocation.contact_phone) : null,
                                selectedSavedLocation.contact_email || null,
                              ].filter(Boolean);
                              if (!contactSummaryParts.length) return null;
                              return (
                                <p className="text-xs uppercase tracking-wide text-muted-foreground/80">
                                  <span className="font-semibold text-foreground">POC:</span> {contactSummaryParts.join(' | ')}
                                </p>
                              );
                            })()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="relative" ref={wrapperRef}>
                    <Input
                      type="text"
                      placeholder="Enter an address or place"
                      value={addressInput}
                      onFocus={() => { if (sugs.length) setOpenAC(true); updateAcPosition(); }}
                      onChange={(e) => {
                        setAddressInput(e?.target?.value);
                        setPickedPlace(null);
                        setOpenAC(true);
                        updateAcPosition();
                      }}
                      onKeyDown={onKeyDown}
                      autoComplete="off"
                      role="combobox"
                      aria-expanded={openAC}
                      aria-autocomplete="list"
                      aria-controls="gmaps-address-suggestions"
                      required
                    />

                    {openAC && (loadingAC || sugs.length > 0) && acRect &&
                      createPortal(
                        <div
                          ref={acPortalRef}
                          style={{
                            position: 'fixed',
                            top: acRect.bottom + 4,
                            left: acRect.left,
                            width: acRect.width,
                          }}
                          className="z-[100000]"
                        >
                          <ul
                            id="gmaps-address-suggestions"
                            role="listbox"
                            className="max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-athletic-lg"
                          >
                            {loadingAC && (
                              <li className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                                <Icon name="Loader2" size={14} className="animate-spin" />
                                Searching…
                              </li>
                            )}
                            {!loadingAC && sugs.length === 0 && (
                              <li className="px-3 py-2 text-sm text-muted-foreground">No matches</li>
                            )}
                            {!loadingAC &&
                              sugs.map((s, i) => (
                                <li
                                  key={s.id}
                                  role="option"
                                  aria-selected={i === hi}
                                  className={`px-3 py-2 text-sm cursor-pointer ${
                                    i === hi ? 'bg-primary/10' : 'hover:bg-muted/50'
                                  }`}
                                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                                  onMouseEnter={() => setHi(i)}
                                >
                                  {s.label}
                                </li>
                              ))}
                            <li className="px-3 py-2 flex justify-end">
                              <img
                                src="https://storage.googleapis.com/geo-devrel-public-buckets/powered_by_google_on_white.png"
                                alt="Powered by Google"
                                className="h-4"
                              />
                            </li>
                          </ul>
                        </div>,
                        document.body
                      )
                    }
                  </div>
                )}
              </div>
          </form>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0 pb-4">
            {/* <Button variant="outline" onClick={onClose}>Cancel</Button> */}
            <Button
              type="submit"
              form="schedule-meal-form"
              disabled={!isValid}
              iconName="Calendar"
              iconSize={16}
            >
              Schedule Meal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleMealModal;
