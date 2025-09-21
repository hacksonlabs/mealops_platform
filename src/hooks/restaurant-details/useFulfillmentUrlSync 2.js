// src/hooks/restaurant-details/useFulfillmentUrlSync.js
const pad = (n) => String(n).padStart(2, '0');
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

import { useCallback, useEffect, useMemo, useState } from 'react';

export default function useFulfillmentUrlSync(location, navigate) {
  const now = useMemo(() => new Date(), []);
  const [fulfillment, setFulfillment] = useState(() => {
    const fromState = location.state?.fulfillment;
    return {
      service: fromState?.service ?? 'delivery',
      address: fromState?.address ?? '',
      coords: fromState?.coords ?? null,
      date: fromState?.date ?? toDateInput(now),
      time: fromState?.time ?? toTimeInput(now),
    };
  });
  const [selectedService, setSelectedService] = useState(
    location.state?.fulfillment?.service ?? 'delivery'
  );

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const svc = qs.get('service');
    const address = qs.get('delivery_address') || qs.get('pickup_address') || qs.get('address') || '';
    const whenISO = qs.get('whenISO');
    const date = qs.get('date');
    const time = qs.get('time');
    const lat = qs.get('lat');
    const lng = qs.get('lng');

    setFulfillment(prev => ({
      ...prev,
      service: svc === 'delivery' || svc === 'pickup' ? svc : prev.service,
      address: address || prev.address,
      coords: lat && lng ? { lat: +lat, lng: +lng } : prev.coords,
      date: date || (whenISO ? toDateInput(new Date(whenISO)) : prev.date),
      time: time || (whenISO ? toTimeInput(new Date(whenISO)) : prev.time),
    }));
    if (svc === 'delivery' || svc === 'pickup') setSelectedService(svc);
  }, [location.search]);

  const syncServiceToUrl = useCallback((svc) => {
    const qs = new URLSearchParams(location.search);
    if (svc) qs.set('service', svc);
    else qs.delete('service');
    navigate({ search: qs.toString() }, { replace: true });
  }, [location.search, navigate]);

  return { fulfillment, setFulfillment, selectedService, setSelectedService, syncServiceToUrl };
}