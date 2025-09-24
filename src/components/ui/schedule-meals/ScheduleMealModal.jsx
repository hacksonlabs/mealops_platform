// /src/components/ui/schedule-meals/ScheduleMealModal.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../AppIcon';
import Button from '../custom/Button';
import Input from '../custom/Input';
import InfoTooltip from '@/components/ui/InfoTooltip';
import { getMealTypeIcon, MEAL_TYPES, SERVICE_TYPES } from '../../../utils/ordersUtils';
import {
  ensurePlacesLib, newSessionToken, fetchAddressSuggestions, getPlaceDetailsFromPrediction
} from '../../../utils/googlePlaces';
import { toTitleCase } from '@/utils/stringUtils';

const ScheduleMealModal = ({ isOpen, onClose, selectedDate, onSchedule, onSearchNearby }) => {
  // --- date helpers ---
  const pad = (n) => String(n).padStart(2, '0');
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
        updateAcPosition();
      } catch {
        setSugs([]);
      } finally {
        setLoadingAC(false);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [addressInput, isOpen]);

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
    if (!openAC && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { setOpenAC(true); updateAcPosition(); return; }
    if (!openAC || sugs.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, sugs.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') {
      const s = sugs[hi];
      if (s) { e.preventDefault(); selectSuggestion(s); }
    } else if (e.key === 'Escape') { setOpenAC(false); }
  };

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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">Location</div>
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

                  {/* Suggestions rendered in a fixed-position portal so they appear above the footer/scroll areas */}
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
                          {/* Required branding for Places */}
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
