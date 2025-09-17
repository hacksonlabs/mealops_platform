// src/hooks/cart/useEmailGate.js
import { useEffect, useMemo, useState } from 'react';
import cartDbService from '@/services/cartDBService';
import { EMAIL_GATE_VERSION } from './constants';

export default function useEmailGate({ cartId, userId }) {
  const [gateOpen, setGateOpen] = useState(true);
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [verifiedIdentity, setVerifiedIdentity] = useState(null); // { email, memberId, fullName, at }

  const storageKey = useMemo(
    () => `sharedCart:gate:${EMAIL_GATE_VERSION}:${cartId}:${userId || 'anon'}`,
    [cartId, userId]
  );

  useEffect(() => {
    if (!cartId) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setVerifiedIdentity(parsed || null);
        setGateOpen(false);
      } else {
        setGateOpen(true);
      }
    } catch {
      setVerifiedIdentity(null);
      setGateOpen(true);
    }
  }, [cartId, storageKey]);

  const submitGateEmail = async (email) => {
    setGateBusy(true);
    setGateErr('');
    try {
      const res = await cartDbService.joinCartWithEmail(cartId, email);
      const identity = {
        email:   res.email,
        memberId: res.memberId,
        fullName: res.fullName,
        at: Date.now(),
      };
      localStorage.setItem(storageKey, JSON.stringify(identity));
      setVerifiedIdentity(identity);
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
    verifiedIdentity,
  };
}
