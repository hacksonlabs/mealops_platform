// /src/components/ui/schedule-meals/ScheduleMealModal.jsx

import React, { useEffect, useRef, useState } from 'react';
import Icon from '../../AppIcon';
import Button from '../custom/Button';
import Input from '../custom/Input';
import { getMealTypeIcon, MEAL_TYPES, SERVICE_TYPES } from '../../../utils/ordersUtils';

import { ensurePlacesLib, newSessionToken, fetchAddressSuggestions, getPlaceDetailsFromPrediction } from '../../../utils/googlePlaces';

const ScheduleMealModal = ({ isOpen, onClose, selectedDate, onSchedule, onSearchNearby }) => {
  // --- date helpers ---
  const pad = (n) => String(n).padStart(2, '0');
  const formatDateInputValue = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dateFromInput = (s) => new Date(`${s}T00:00:00`);
  const prettyDate = (dateStr) =>
    dateStr
      ? dateFromInput(dateStr).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
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
    serviceType: 'delivery',
  });

  // address/autocomplete state
  const [addressInput, setAddressInput] = useState('');
  const [pickedPlace, setPickedPlace] = useState(null); // { formattedAddress, location: {lat,lng}, id }
  const hasAddress = Boolean((pickedPlace?.formattedAddress || addressInput)?.trim());
  const hasFulfillment = Boolean(formData?.serviceType);

  const isValid = Boolean(formData?.date && formData?.time && formData?.mealType && hasAddress && hasFulfillment);

  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, date: formatDateInputValue(selectedDate) }));
    }
  }, [selectedDate]);

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

  // Close suggestions when clicking outside
  useEffect(() => {
    const onDocClick = (e) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) setOpenAC(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Fetch predictions (debounced)
  useEffect(() => {
    if (!isOpen || !placesReadyRef.current) return;

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
      } catch {
        setSugs([]);
      } finally {
        setLoadingAC(false);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addressInput, isOpen]);

  const resetSessionToken = async () => {
    sessionTokenRef.current = await newSessionToken();
  };

  // Convert a suggestion to a Place and fetch details
  const selectSuggestion = async (sugg) => {
    try {
      const details = await getPlaceDetailsFromPrediction(sugg.raw?.placePrediction, [
        'id',
        'formattedAddress',
        'location',
      ]);
      if (!details) {
        setOpenAC(false);
        return;
      }
      setPickedPlace({
        id: details.id,
        formattedAddress: details.formattedAddress,
        location: details.location,
      });
      setAddressInput(details.formattedAddress || sugg.label || '');
      setOpenAC(false);
    } finally {
      await resetSessionToken(); // per Google guidance
    }
  };

  const onKeyDown = (e) => {
    if (!openAC && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpenAC(true);
      return;
    }
    if (!openAC || sugs.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => Math.min(h + 1, sugs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      const s = sugs[hi];
      if (s) {
        e.preventDefault();
        selectSuggestion(s);
      }
    } else if (e.key === 'Escape') {
      setOpenAC(false);
    }
  };

  // Submit
  const handleSubmit = (e) => {
    e?.preventDefault();

    const address = pickedPlace?.formattedAddress || addressInput || '';
    const coords  = pickedPlace?.location || null;

    const payload = {
      title: (formData.title || '').trim(),
      mealType: formData.mealType,
      date: formData.date,               // YYYY-MM-DD
      time: formData.time,               // HH:mm
      serviceType: formData.serviceType, // 'delivery' | 'pickup'
      address,                           // raw address input
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-athletic-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-heading font-semibold text-foreground">Schedule Meal</h2>
            <p className="text-sm text-muted-foreground mt-1">{prettyDate(formData?.date)}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} iconName="X" iconSize={20} />
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Meal Title*/}
            <div className="space-y-1">
              <Input
                label="Meal Title"
                type="text"
                placeholder="e.g., SD Post Game"
                value={formData.title}
                maxLength={80}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e?.target?.value }))}
              />
            </div>
            {/* Meal Type and Date/Time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Meal type */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-foreground">Meal Type</label>
                <div className="space-y-2">
                  {MEAL_TYPES.map(({ value, label }) => {
                    const selected = formData?.mealType === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, mealType: value }))}
                        className={`w-full flex items-center space-x-3 p-3 border rounded-md transition-athletic
                          ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                      >
                        <Icon name={getMealTypeIcon(value)} size={16} />
                        <span className="text-sm font-medium">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date & time */}
              <div className="space-y-3">
                <Input
                  label="Date"
                  type="date"
                  value={formData?.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e?.target?.value }))}
                  required
                />
                <Input
                  label="Time"
                  type="time"
                  value={formData?.time}
                  onChange={(e) => setFormData((prev) => ({ ...prev, time: e?.target?.value }))}
                  required
                />
              </div>
            </div>

            {/* Location & Fulfillment */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">Location & Fulfillment</label>

              {/* Address + Autocomplete */}
              <div className="relative" ref={wrapperRef}>
                <Input
                  type="text"
                  placeholder="Start typing an address or place"
                  value={addressInput}
                  onFocus={() => sugs.length && setOpenAC(true)}
                  onChange={(e) => {
                    setAddressInput(e?.target?.value);
                    setPickedPlace(null);
                    setOpenAC(true);
                  }}
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={openAC}
                  aria-autocomplete="list"
                  aria-controls="gmaps-address-suggestions"
                />

                {openAC && (loadingAC || sugs.length > 0) && (
                  <ul
                    id="gmaps-address-suggestions"
                    role="listbox"
                    className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border border-border bg-popover shadow-athletic-lg"
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
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectSuggestion(s);
                          }}
                          onMouseEnter={() => setHi(i)}
                        >
                          {s.label}
                        </li>
                      ))}
                    {/* Required branding when rendering predictions outside a Google Map */}
                    <li className="px-3 py-2 flex justify-end">
                      <img
                        src="https://storage.googleapis.com/geo-devrel-public-buckets/powered_by_google_on_white.png"
                        alt="Powered by Google"
                        className="h-4"
                      />
                    </li>
                  </ul>
                )}
              </div>

              {/* Delivery vs Pickup */}
              <div className="grid grid-cols-2 gap-2">
                {SERVICE_TYPES.map(({ value, label, icon }) => {
                  const selected = formData?.serviceType === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, serviceType: value }))}
                      className={`w-full flex items-center justify-center gap-2 p-3 border rounded-md transition-athletic
                        ${selected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <Icon name={icon} size={16} />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Optional "Search nearby" (delegates to parent) */}
              {onSearchNearby && (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    iconName="Search"
                    onClick={handleSearchNearby}
                    disabled={!addressInput && !pickedPlace}
                  >
                    Search nearby
                  </Button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid} iconName="Calendar" iconSize={16}>
            Schedule Meal
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleMealModal;