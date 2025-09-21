// src/hooks/cart/useEmailGate.js
import { useEffect, useMemo, useState } from 'react';
import cartDbService from '@/services/cartDBService';
import { EMAIL_GATE_VERSION } from './constants';

export default function useEmailGate({ cartId, userId, persist = 'local', wipeExisting = false }) {
  const [gateOpen, setGateOpen] = useState(true);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [verifiedIdentity, setVerifiedIdentity] = useState(null); // { email, memberId, fullName, at }

  const storageKey = useMemo(
    () => `sharedCart:gate:${EMAIL_GATE_VERSION}:${cartId}:${userId || 'anon'}`,
    [cartId, userId]
  );

  const getStore = () => (persist === 'local' ? window.localStorage
                    : persist === 'session' ? window.sessionStorage
                    : null);

  useEffect(() => {
    if (!cartId) return;

    // Optional: wipe any old persisted identity when switching to non-persistent mode
    if (wipeExisting) {
      try {
        window.localStorage.removeItem(storageKey);
        window.sessionStorage.removeItem(storageKey);
      } catch {}
    }

    // Read only if we’re persisting
    if (persist === 'local' || persist === 'session') {
      try {
        const store = getStore();
        const raw = store?.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setVerifiedIdentity(parsed || null);
          setGateOpen(false);
          return;
        }
      } catch {}
    }

    // Default: require email each time
    setVerifiedIdentity(null);
    setGateOpen(true);
  }, [cartId, storageKey, persist, wipeExisting]);

  const submitGateEmail = async (email) => {
    setGateBusy(true);
    setGateErr('');
    try {
      const res = await cartDbService.joinCartWithEmail(cartId, email);
      const identity = {
        email:    res.email,
        memberId: res.memberId,
        fullName: res.fullName,
        at: Date.now(),
      };

      // Persist only if configured
      try {
        const store = getStore();
        if (store) store.setItem(storageKey, JSON.stringify(identity));
      } catch {}

      setVerifiedIdentity(identity);
      setGateOpen(false);
    } catch (e) {
      setGateErr(e?.message || 'Could not verify your email for this team.');
    } finally {
      setGateBusy(false);
    }
  };

  const forgetGate = () => {
    try {
      window.localStorage.removeItem(storageKey);
      window.sessionStorage.removeItem(storageKey);
    } catch {}
    setVerifiedIdentity(null);
    setGateOpen(true);
  };

  return {
    gateOpen,
    gateBusy,
    gateErr,
    submitGateEmail,
    clearGateError: () => setGateErr(''),
    verifiedIdentity,
    forgetGate,
  };
}