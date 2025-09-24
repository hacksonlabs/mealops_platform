import { useEffect, useState } from 'react';
import { geocodeAddress, computeDistanceMeters, metersToMiles, formatMiles } from '@/utils/googlePlaces';

export default function useDistances(centerCoords, rows, setRows) {
  const [distanceReady, setDistanceReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!centerCoords || rows.length === 0) {
      setDistanceReady(true);
      return;
    }

    (async () => {
      try {
        const updated = rows.map((original) => ({ ...original }));
        for (let i = 0; i < updated.length; i++) {
          if (cancelled) return;
          const r = updated[i];

          if (!r._coords && r._address) {
            try {
              r._coords = await geocodeAddress(r._address);
            } catch {
              r._coords = null;
            }
          }

          if (r._coords) {
            const meters = await computeDistanceMeters(centerCoords, r._coords);
            r._distanceMeters = meters ?? null;
            const miles = metersToMiles(meters ?? null);
            r.distance = miles != null ? formatMiles(miles) : undefined;
          } else {
            r._distanceMeters = null;
            r.distance = undefined;
          }
        }

        if (!cancelled) {
          setRows(updated);
          setDistanceReady(true);
        }
      } catch {
        if (!cancelled) {
          console.warn('[Discovery] useDistances: distance calc failed');
          setDistanceReady(true);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [centerCoords?.lat, centerCoords?.lng, rows.length]); // avoid infinite loops

  return { distanceReady };
}
