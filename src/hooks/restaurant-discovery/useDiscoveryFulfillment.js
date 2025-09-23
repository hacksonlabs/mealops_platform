import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// small helpers
const pad = n => String(n).padStart(2, '0');
const toDateInput = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const toTimeInput = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function useDiscoveryFulfillment() {
  const location = useLocation();
  const navigate = useNavigate();

  const [selectedService, setSelectedService] = useState('delivery');
  const [fulfillment, setFulfillment] = useState(() => {
    const now = new Date();
    return {
      service: 'delivery',
      address: '',
      coords: null,
      date: toDateInput(now),
      time: toTimeInput(now),
    };
  });

  const setServiceParam = useCallback((svc) => {
    const qs = new URLSearchParams(location.search);
    if (svc) qs.set('service', svc);
    else qs.delete('service');
    navigate({ search: qs.toString() }, { replace: true });
  }, [location.search, navigate]);

  // read URL -> fulfillment + service
  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const svc = qs.get('service');
    const address = qs.get('delivery_address') || qs.get('pickup_address') || qs.get('address') || '';
    const whenISO = qs.get('whenISO');
    const date = qs.get('date');
    const time = qs.get('time');
    const lat = qs.get('lat');
    const lng = qs.get('lng');

    const fromWhen = whenISO ? new Date(whenISO) : null;

    setFulfillment(prev => ({
      ...prev,
      service: svc || prev.service,
      address: address || prev.address,
      coords: lat && lng ? { lat: +lat, lng: +lng } : prev.coords,
      date: date || (fromWhen ? toDateInput(fromWhen) : prev.date),
      time: time || (fromWhen ? toTimeInput(fromWhen) : prev.time),
    }));
    if (svc) setSelectedService(svc);
    if (address) {
      window.dispatchEvent(new CustomEvent('deliveryAddressUpdate', {
        detail: { address, lat: lat && lng ? { lat: +lat, lng: +lng } : null },
      }));
    }
  }, [location.search]);

  const handleFulfillmentChange = useCallback((next) => {
    setFulfillment(next);
    setSelectedService(next.service);
    setServiceParam(next.service);
    // legacy broadcast
    window.dispatchEvent(new CustomEvent('deliveryAddressUpdate', {
      detail: { address: next.address, lat: next.coords ?? null },
    }));
  }, [fulfillment.service, setServiceParam]);

  return { fulfillment, selectedService, setSelectedService, handleFulfillmentChange, setServiceParam };
}
