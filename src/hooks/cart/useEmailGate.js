// src/hooks/cart/useEmailGate.js
import { useEffect, useMemo, useState } from 'react';
import cartDbService from '@/services/cartDBService';
import { EMAIL_GATE_VERSION } from './constants';

export default function useEmailGate({ cartId, userId }) {
  const [gateOpen, setGateOpen] = useState(true);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState('');

  const storageKey = useMemo(
    () => `sharedCart:gate:${EMAIL_GATE_VERSION}:${cartId}:${userId || 'anon'}`,
    [cartId, userId]
  );

  useEffect(() => {
    if (!cartId) return;
    const raw = localStorage.getItem(storageKey);
    setGateOpen(!raw); // open if not seen
  }, [cartId, storageKey]);

  const submitGateEmail = async (email) => {
    setGateBusy(true);
    setGateErr('');
    try {
      await cartDbService.joinCartWithEmail(cartId, email);
      localStorage.setItem(storageKey, JSON.stringify({ email, at: Date.now() }));
      setGateOpen(false);
    } catch (e) {
      setGateErr(e?.message || 'Could not verify your email for this team.');
    } finally {
      setGateBusy(false);
    }
  };

  return {
    gateOpen,
    gateBusy,
    gateErr,
    submitGateEmail,
    clearGateError: () => setGateErr(''),
  };
}
