// src/hooks//common/useDistanceMiles.js
import { useEffect, useState } from 'react';
import { computeDistanceMeters, metersToMiles, geocodeAddress } from '../../utils/googlePlaces';

export default function useDistanceMiles({ restaurant, fulfillment }) {
  const [mi, setMi] = useState();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!restaurant) return;
      const rCoords =
        restaurant._coords ||
        (restaurant.lat && restaurant.lng ? { lat: Number(restaurant.lat), lng: Number(restaurant.lng) } : null) ||
        (restaurant.address ? await geocodeAddress(restaurant.address) : null);

      const uCoords =
        fulfillment?.coords ||
        (fulfillment?.address ? await geocodeAddress(fulfillment.address) : null);

      if (!rCoords || !uCoords) return;
      const meters = await computeDistanceMeters(rCoords, uCoords);
      if (!cancelled) setMi(metersToMiles(meters));
    })();
    return () => { cancelled = true; };
  }, [restaurant, fulfillment?.coords, fulfillment?.address]);

  return mi;
}