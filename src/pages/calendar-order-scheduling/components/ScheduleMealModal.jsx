import React, { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { getMealTypeIcon, MEAL_TYPES, SERVICE_TYPES } from '../../../utils/ordersUtils';

// Loads the 'places' library using the modern Maps loader that must be added in index.html
async function loadPlacesLibrary() {
  const g = window.google;
  if (!g?.maps?.importLibrary) {
    throw new Error(
      'Google Maps JS loaded without importLibrary. Ensure index.html uses v=weekly & libraries=places & loading=async, and that the script is loaded before other libraries.'
    );
  }
  // @ts-ignore
  return await g.maps.importLibrary('places');
}

const ScheduleMealModal = ({
  isOpen,
  onClose,
  selectedDate,
  onSchedule,
  onSearchNearby // optional: (payload) => void
}) => {
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
    mealType: 'lunch',
    date: formatDateInputValue(selectedDate || new Date()),
    time: '12:00',
    serviceType: 'delivery',
  });

  // address/autocomplete state (kept separate for clarity)
  const [addressInput, setAddressInput] = useState('');
  const [pickedPlace, setPickedPlace] = useState(null); // { formattedAddress, location: {lat,lng}, id }

  const isValid = Boolean(formData?.date && formData?.time && formData?.mealType);

  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({ ...prev, date: formatDateInputValue(selectedDate) }));
    }
  }, [selectedDate]);

  // --- Google Places (New) ---
  const servicesRef = useRef({
    AutocompleteSuggestion: null,
    AutocompleteSessionToken: null,
  });
  const sessionTokenRef = useRef(null);

  // Suggestions UI state
  const [openAC, setOpenAC] = useState(false);
  const [loadingAC, setLoadingAC] = useState(false);
  const [sugs, setSugs] = useState([]); // array of { placePrediction, id, label }
  const [hi, setHi] = useState(0); // highlighted index
  const wrapperRef = useRef(null);
  const debounceRef = useRef(null);

  // Load the new Places library when modal opens
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!isOpen) return;
      const placesLib = await loadPlacesLibrary();
      if (!mounted || !placesLib) return;

      const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib;
      servicesRef.current.AutocompleteSuggestion = AutocompleteSuggestion;
      servicesRef.current.AutocompleteSessionToken = AutocompleteSessionToken;
      sessionTokenRef.current = new AutocompleteSessionToken(); // start a session
    })();

    return () => {
      mounted = false;
    };
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
    if (!isOpen) return;

    const q = addressInput?.trim();
    if (!q || q.length < 3 || !servicesRef.current.AutocompleteSuggestion) {
      setSugs([]);
      setLoadingAC(false);
      return;
    }

    setLoadingAC(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { AutocompleteSuggestion } = servicesRef.current;
        const token = sessionTokenRef.current;
        const request = {
          input: q,
          sessionToken: token,
        };
        const { suggestions } =
          (await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)) || {};

        // Map into a simple shape for rendering
        const mapped =
          (suggestions || []).slice(0, 6).map((s, idx) => ({
            raw: s,
            id: s?.placePrediction?.placeId || `sugg-${idx}-${Date.now()}`,
            label:
              (s?.placePrediction?.text &&
                s.placePrediction.text.toString &&
                s.placePrediction.text.toString()) ||
              s?.placePrediction?.text ||
              '',
          })) || [];

        setSugs(mapped.filter((m) => m.label));
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

  const resetSessionToken = () => {
    const lib = servicesRef.current;
    if (lib.AutocompleteSessionToken) {
      sessionTokenRef.current = new lib.AutocompleteSessionToken();
    }
  };

  // Convert a suggestion to a Place and fetch details
  const selectSuggestion = async (sugg) => {
    try {
      // @ts-ignore
      const placesLib = await window.google.maps.importLibrary('places');
      const pp = sugg.raw?.placePrediction;
      if (!pp?.toPlace) {
        setOpenAC(false);
        return;
      }
      const place = pp.toPlace();
      await place.fetchFields({ fields: ['id', 'formattedAddress', 'location'] });

      const loc = place.location?.toJSON ? place.location.toJSON() : null;

      setPickedPlace({
        formattedAddress: place.formattedAddress,
        location: loc ? { lat: loc.lat, lng: loc.lng } : null,
        id: place.id,
      });
      setAddressInput(place.formattedAddress || sugg.label || '');
      setOpenAC(false);
    } finally {
      // per Google guidance
      resetSessionToken();
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

    const orderData = {
      id: Date.now(),
      date: toISOFromLocal(formData?.date, formData?.time),
      mealType: formData?.mealType,
      time: formData?.time,
      serviceType: formData?.serviceType,
      address: pickedPlace?.formattedAddress || addressInput || '',
      location: pickedPlace?.location || null,
    };

    onSchedule(orderData);
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

              {/* Address + Autocomplete (Google Places New) */}
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
