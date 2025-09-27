import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ensurePlacesLib,
  newSessionToken,
  fetchAddressSuggestions,
  getPlaceDetailsFromPrediction,
} from '@/utils/googlePlaces';
import { cn } from '@/utils/cn';

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

export default PlacesAutocompleteInput;
