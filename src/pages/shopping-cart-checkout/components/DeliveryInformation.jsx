// src/pages/checkout/components/DeliveryInformation.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/custom/Button';
import Input from '../../../components/ui/custom/Input';
import cartDbService from '../../../services/cartDBService';
import { useAuth } from '@/contexts';
import { supabase } from '@/lib/supabase';

import {
  newSessionToken,
  fetchAddressSuggestions,
  getPlaceDetailsFromPrediction,
  geocodeAddress,
} from '../../../utils/googlePlaces';

// --- small helpers for floating portal ----
function FloatingPortal({ children }) {
  if (typeof document === 'undefined') return null;
  const elRef = useRef(null);
  if (!elRef.current) elRef.current = document.createElement('div');
  useEffect(() => {
    const el = elRef.current;
    document.body.appendChild(el);
    return () => void document.body.removeChild(el);
  }, []);
  return createPortal(children, elRef.current);
}

function FloatingDropdown({ anchorRef, children, onRequestClose }) {
  const [rect, setRect] = useState(null);
  const dropdownRef = useRef(null);

  const update = () => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setRect({ top: r.bottom, left: r.left, width: r.width });
  };

  useEffect(() => {
    update();
    const onScroll = () => update();
    const onResize = () => update();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      const drop = dropdownRef.current;
      const anchor = anchorRef.current;
      if (!drop || !anchor) return;
      if (drop.contains(e.target) || anchor.contains(e.target)) return;
      onRequestClose?.();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onRequestClose]);

  if (!rect) return null;
  

  return (
    <FloatingPortal>
      <div
        ref={dropdownRef}
        style={{ position: 'fixed', top: rect.top, left: rect.left, width: rect.width, zIndex: 3000 }}
        className="rounded-md border border-border bg-popover shadow-md"
      >
        {children}
        <div className="px-3 py-1 border-t border-border text-[10px] uppercase tracking-wide text-muted-foreground">
          Powered by Google
        </div>
      </div>
    </FloatingPortal>
  );
}

/**
 * Props:
 * - cartId: UUID of the meal cart (REQUIRED to save to DB)
 * - fulfillment: { service, address, coords, date, time }  (current values from DB)
 * - onFulfillmentChange(next): optional; lets parent mirror local state
 * - serviceType, deliveryAddress: kept for backward compatibility with your layout
 */
const DeliveryInformation = ({
  cartId,
  fulfillment,
  onFulfillmentChange,
  serviceType,
  deliveryAddress,
  onAddressChange,
  onAddressResolved,
  pickupTime,
  onPickupTimeChange,
  pickupAddress = '',
  pickupName = '',
  instructions,
  onInstructionsChange, 
}) => {
  const { activeTeam } = useAuth();
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  // Initialize input from DB fulfillment.address, falling back to prop
  const [newAddress, setNewAddress] = useState(
    fulfillment?.address ?? deliveryAddress ?? ''
  );

  const [specialInstructions, setSpecialInstructions] = useState(instructions ?? '');
  useEffect(() => {
    setSpecialInstructions(instructions ?? '');
  }, [instructions]);

  const [savedLocations, setSavedLocations] = useState([]);

  const currentAddress = useMemo(
    () => (fulfillment?.address || deliveryAddress || '').trim().toLowerCase(),
    [fulfillment?.address, deliveryAddress]
  );

  const matchedSavedLocation = useMemo(() => {
    if (!currentAddress) return null;
    return savedLocations.find((location) =>
      (location.formatted_address || '').trim().toLowerCase() === currentAddress ||
      (location.address_name || '').trim().toLowerCase() === currentAddress
    ) || null;
  }, [currentAddress, savedLocations]);

  useEffect(() => {
    if (!matchedSavedLocation?.delivery_notes) return;
    const notes = matchedSavedLocation.delivery_notes.trim();
    if (!notes) return;

    const currentInstructions = (specialInstructions || '').trim();
    if (currentInstructions.length > 0) return;

    setSpecialInstructions(notes);
    onInstructionsChange?.(notes);
  }, [matchedSavedLocation, specialInstructions, onInstructionsChange]);

  // Google Places state
  const [sessionToken, setSessionToken] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [placesErr, setPlacesErr] = useState('');
  const selectedPredictionRef = useRef(null);
  const debounceRef = useRef(0);

   // --- close helpers ---
  const closeAddressModal = () => {
    setIsAddressModalOpen(false);
    setSuggestions([]);        // clear suggestions
    setPlacesErr('');          // clear any Places error
    selectedPredictionRef.current = null;
  };

  useEffect(() => {
    const loadSavedLocations = async () => {
      if (!activeTeam?.id) {
        setSavedLocations([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('saved_locations')
          .select('id, address_name, formatted_address, delivery_notes')
          .eq('team_id', activeTeam.id);

        if (error) throw error;

        setSavedLocations(data || []);
      } catch (error) {
        console.error('Failed to load saved locations', error);
        setSavedLocations([]);
      }
    };

    loadSavedLocations();
  }, [activeTeam?.id]);

  const handleBackdropClick = (e) => {
    // Only close if the click is directly on the backdrop, not inside the panel
    if (e.target === e.currentTarget) closeAddressModal();
  };

  // Close on Esc
  useEffect(() => {
    if (!isAddressModalOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeAddressModal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAddressModalOpen]);

  // keep input current when parent fulfillment changes
  useEffect(() => {
    if (!isAddressModalOpen) {
      setNewAddress(fulfillment?.address ?? deliveryAddress ?? '');
    }
  }, [isAddressModalOpen, fulfillment?.address, deliveryAddress]);

  // Anchor for floating dropdown (wrap the Input)
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!isAddressModalOpen) return;
    setNewAddress(fulfillment?.address ?? deliveryAddress ?? '');
    setSuggestions([]);
    setPlacesErr('');
    selectedPredictionRef.current = null;
    (async () => {
      try {
        const tok = await newSessionToken();
        setSessionToken(tok);
      } catch (e) {
        setSessionToken(null);
        setPlacesErr(e?.message || 'Google Places not available');
      }
    })();
  }, [isAddressModalOpen, fulfillment?.address, deliveryAddress]);

  const handleAddressInput = (e) => {
    const val = e?.target?.value ?? '';
    setNewAddress(val);
    setPlacesErr('');
    selectedPredictionRef.current = null;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val.trim()) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      if (!sessionToken) return;
      setIsSuggesting(true);
      try {
        const list = await fetchAddressSuggestions(val, sessionToken);
        setSuggestions(list);
      } catch (err) {
        setPlacesErr(err?.message || 'Autocomplete failed');
        setSuggestions([]);
      } finally {
        setIsSuggesting(false);
      }
    }, 220);
  };

  const handlePickSuggestion = async (sugg) => {
    setPlacesErr('');
    setSuggestions([]);
    const pred = sugg?.raw?.placePrediction;
    selectedPredictionRef.current = pred || null;
    setNewAddress(sugg?.label || '');
  };

  const resolveCoordinates = async (address) => {
    if (!address) return null;
    return geocodeAddress(address.trim());
  };

  const handleSaveAddress = async () => {
    if (!cartId) {
      setPlacesErr('Missing cartId — cannot save.');
      return;
    }
    try {
      // Resolve full details if possible (formattedAddress + lat/lng)
      let finalDetails = null;
      if (selectedPredictionRef.current) {
        finalDetails = await getPlaceDetailsFromPrediction(
          selectedPredictionRef.current,
          ['id', 'formattedAddress', 'location', 'displayName']
        );
      } else if (newAddress?.trim()) {
        // user typed manually -> try geocoding just to get coords
        const coords = await resolveCoordinates(newAddress.trim());
        finalDetails = {
          id: null,
          formattedAddress: newAddress.trim(),
          location: coords,
          displayName: null,
        };
      }

      const finalAddress = finalDetails?.formattedAddress || newAddress || '';
      const coords = finalDetails?.location || fulfillment?.coords || null;

      // Persist to DB (keep existing service/date/time unless you change them)
      const nextFulfillment = {
        service: fulfillment?.service ?? serviceType ?? 'delivery',
        address: finalAddress,
        coords, // {lat,lng} or null
        date: fulfillment?.date ?? null,
        time: fulfillment?.time ?? null,
      };

      await cartDbService.upsertCartFulfillment(cartId, nextFulfillment);

      // Notify parent states (both old and new props for compatibility)
      onAddressChange?.(finalAddress);
      onAddressResolved?.(finalDetails);
      onFulfillmentChange?.(nextFulfillment);

      setIsAddressModalOpen(false);
    } catch (e) {
      setPlacesErr(e?.message || 'Failed to save address');
    }
  };

  // --- pickup path ---
  if ((fulfillment?.service ?? serviceType) === 'pickup') {
    return (
      <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Pickup Information</h2>
          <Icon name="ShoppingBag" size={20} className="text-primary" />
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Icon name="MapPin" size={18} className="text-primary mt-1" />
              <div>
                {/* Show restaurant NAME first, then ADDRESS */}
                <h3 className="font-medium text-foreground">
                  {pickupName || 'Restaurant Address'}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {pickupAddress || 'Address unavailable'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- delivery path ---
  return (
    <>
      <div className="bg-card border border-border rounded-lg p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Delivery Information</h2>
          <Icon name="Truck" size={20} className="text-primary" />
        </div>

        <div className="space-y-4">
          {/* Delivery Address */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Delivery Address</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddressModalOpen(true)}
                className="text-primary"
              >
                <Icon name="Edit2" size={14} className="mr-1" />
                Change
              </Button>
            </div>

            <div className="p-3 bg-muted/50 border border-border rounded-lg">
              <div className="flex items-start space-x-2">
                <Icon name="MapPin" size={16} className="text-primary mt-1" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {fulfillment?.address || deliveryAddress || '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Special Instructions (kept local for now) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Special Delivery Instructions (Optional)
            </label>
            <textarea
              value={specialInstructions}
              onChange={(e) => {
                const val = e?.target?.value ?? '';
                setSpecialInstructions(val);
                onInstructionsChange?.(val);
              }}
              placeholder="e.g., Meet in front of the gym, Call when entering campus, etc.."
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1">Help our delivery partner find you easily</p>
          </div>
        </div>
      </div>

      {/* Address Change Modal */}
      {isAddressModalOpen && (
        <div
          className="fixed inset-0 z-[1100] bg-black bg-opacity-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Change delivery address"
        >
          <div
            className="bg-card rounded-lg shadow-elevation-2 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Change Delivery Address</h3>
                <Button variant="ghost" size="icon" onClick={closeAddressModal}>
                  <Icon name="X" size={20} />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="relative" ref={anchorRef}>
                  <Input
                    label="Delivery Address"
                    type="text"
                    placeholder="Start typing your address"
                    value={newAddress}
                    onChange={handleAddressInput}
                    autoComplete="street-address"
                  />
                  {isSuggesting && (
                    <div className="absolute right-2 top-9 text-xs text-muted-foreground">Searching…</div>
                  )}
                </div>

                {!!suggestions.length && (
                  <FloatingDropdown
                    anchorRef={anchorRef}
                    onRequestClose={() => setSuggestions([])}
                  >
                    <ul className="max-h-64 overflow-auto py-1">
                      {suggestions.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => handlePickSuggestion(s)}
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-micro flex items-start gap-2"
                          >
                            <Icon name="MapPin" size={14} className="mt-0.5 text-muted-foreground" />
                            <span className="text-sm text-foreground">{s.label}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </FloatingDropdown>
                )}

                {placesErr && <div className="text-xs text-destructive">{placesErr}</div>}

                <div className="flex space-x-3 pt-2">
                  <Button onClick={handleSaveAddress} className="flex-1">
                    Save Address
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

export default DeliveryInformation;
