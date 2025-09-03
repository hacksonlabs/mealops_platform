// src/utils/googlePlaces.js
// Requires the Maps JS script to be loaded once in index.html with:
// https://maps.googleapis.com/maps/api/js?key=%VITE_GOOGLE_MAPS_API_KEY%&v=weekly&libraries=places&loading=async

let placesLibPromise = null;

/** Ensure the 'places' library is available (uses the modern importLibrary pattern). */
export async function ensurePlacesLib() {
  if (!placesLibPromise) {
    const g = window.google;
    if (!g?.maps?.importLibrary) {
      throw new Error(
        'Google Maps JS not ready. Load it once in index.html with v=weekly&libraries=places&loading=async'
      );
    }
    placesLibPromise = g.maps.importLibrary('places');
  }
  return placesLibPromise;
}

/** Create a new Autocomplete session token (recommended for billing/quality). */
export async function newSessionToken() {
  const lib = await ensurePlacesLib();
  return new lib.AutocompleteSessionToken();
}

/** Fetch autocomplete suggestions (custom UI). Returns normalized items. */
export async function fetchAddressSuggestions(input, sessionToken, opts = {}) {
  if (!input?.trim()) return [];
  const lib = await ensurePlacesLib();
  const { AutocompleteSuggestion } = lib;

  const request = {
    input,
    sessionToken,
    // You can pass optional params via opts if you want:
    // includedPrimaryTypes: ['street_address', 'premise', 'establishment'],
    // locationBias: { center: { lat, lng }, radius: 3000 },
    ...opts,
  };

  const { suggestions = [] } =
    (await AutocompleteSuggestion.fetchAutocompleteSuggestions(request)) || {};

  // Normalize to a simple shape for your UI
  return suggestions
    .slice(0, 6)
    .map((s, i) => {
      const pp = s.placePrediction;
      const label =
        (pp?.text && pp.text.toString && pp.text.toString()) || pp?.text || '';
      return {
        id: pp?.placeId || `sugg-${i}-${Date.now()}`,
        label,
        raw: s, // keep full object for follow-up
      };
    })
    .filter((x) => x.label);
}

/** Resolve a suggestion's prediction into place details (address + lat/lng). */
export async function getPlaceDetailsFromPrediction(placePrediction, fields = ['id', 'formattedAddress', 'location']) {
  if (!placePrediction?.toPlace) return null;
  const place = placePrediction.toPlace();
  await place.fetchFields({ fields });
  const loc = place.location?.toJSON ? place.location.toJSON() : null;
  return {
    id: place.id,
    formattedAddress: place.formattedAddress || '',
    location: loc ? { lat: loc.lat, lng: loc.lng } : null,
    // displayName is available if you request it in 'fields'
    displayName:
      (place.displayName && (place.displayName.text || `${place.displayName}`)) || null,
  };
}

/** Search nearby restaurants (optional helper you can call from the parent). */
export async function searchNearbyRestaurants(center, {
  radius = 3000,
  maxResultCount = 10,
  rank = 'POPULARITY', // or 'DISTANCE'
  language = 'en-US',
  region = 'us',
} = {}) {
  const lib = await ensurePlacesLib();
  const { Place, SearchNearbyRankPreference } = lib;

  const request = {
    fields: ['id', 'displayName', 'location', 'rating', 'businessStatus', 'types'],
    locationRestriction: { center, radius },
    includedPrimaryTypes: ['restaurant'],
    maxResultCount,
    rankPreference:
      rank === 'DISTANCE'
        ? SearchNearbyRankPreference.DISTANCE
        : SearchNearbyRankPreference.POPULARITY,
    language,
    region,
  };
  const { places = [] } = await Place.searchNearby(request);
  return places;
}
