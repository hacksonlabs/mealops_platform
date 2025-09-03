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


let geoLibPromise = null;
let geomLibPromise = null;

export async function ensureGeocodingLib() {
  if (!geoLibPromise) {
    const g = window.google;
    if (!g?.maps?.importLibrary) {
      throw new Error('Google Maps JS not ready (geocoding).');
    }
    geoLibPromise = g.maps.importLibrary('geocoding');
  }
  return geoLibPromise;
}

export async function ensureGeometryLib() {
  if (!geomLibPromise) {
    const g = window.google;
    if (!g?.maps?.importLibrary) {
      throw new Error('Google Maps JS not ready (geometry).');
    }
    geomLibPromise = g.maps.importLibrary('geometry');
  }
  return geomLibPromise;
}

/** Geocode a single address -> { lat, lng } (uses cache to cut calls). */
const __geocodeCache = new Map(); // address -> {lat,lng}
export async function geocodeAddress(address) {
  if (!address) return null;
  if (__geocodeCache.has(address)) return __geocodeCache.get(address);

  const { Geocoder } = await ensureGeocodingLib();
  const geocoder = new Geocoder();

  const { results } = await geocoder.geocode({ address });
  const loc = results?.[0]?.geometry?.location?.toJSON?.();
  const coords = loc ? { lat: loc.lat, lng: loc.lng } : null;

  __geocodeCache.set(address, coords);
  return coords;
}

/** Compute distance in meters between two {lat,lng}. Prefers Google geometry, falls back to haversine. */
export async function computeDistanceMeters(a, b) {
  if (!a || !b) return null;

  try {
    const { spherical } = await ensureGeometryLib();
    const g = window.google;
    const d = spherical.computeDistanceBetween(
      new g.maps.LatLng(a.lat, a.lng),
      new g.maps.LatLng(b.lat, b.lng)
    );
    return d; // meters
  } catch {
    // Fallback: haversine
    const R = 6371000; // meters
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const sinDLat = Math.sin(dLat / 2);
    const sinDLng = Math.sin(dLng / 2);
    const h =
      sinDLat * sinDLat +
      Math.cos(la1) * Math.cos(la2) * sinDLng * sinDLng;
    return 2 * R * Math.asin(Math.sqrt(h));
  }
}

export const metersToMiles = (m) => (m == null ? null : (m / 1609.344));
export const formatMiles = (mi, digits = 1) =>
  mi == null ? '' : `${mi.toFixed(mi < 10 ? digits : 0)} mi`;