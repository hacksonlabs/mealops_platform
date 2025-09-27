// src/services/paymentService.js
import { supabase } from '../lib/supabase';
import { featureFlags } from '../config/runtimeConfig';
import { mealmeApi } from './mealmeApi';

/** ----------------------------------------------------------------------
 * Provider selection
 *  - env: VITE_PAYMENTS_PROVIDER = 'stripe' | 'mealme'
 *  - env: VITE_PAYMENTS_MOCK = '1' to bypass ALL network calls (uses mock adapter)
 * --------------------------------------------------------------------- */
const ENV_PROVIDER = (import.meta?.env?.VITE_PAYMENTS_PROVIDER || (featureFlags.mealMeEnabled ? 'mealme' : 'stripe')).toLowerCase();
const DEFAULT_PROVIDER = featureFlags.mealMeEnabled ? 'mealme' : 'stripe';
const FORCE_MOCK = featureFlags.paymentsMock;

/** Common error mapper */
const handleServiceError = (error, operation) => {
  console.error(`Payment Service - ${operation} error:`, error);
  if (error?.code === 'PGRST116') return { data: [], error: null };
  if (error?.code === '42501')
    return { data: null, error: { message: 'Access denied. Please check your team membership.', code: 'ACCESS_DENIED' } };
  if (error?.message?.includes('JWT'))
    return { data: null, error: { message: 'Authentication expired. Please refresh the page.', code: 'AUTH_EXPIRED' } };
  return { data: null, error: { message: error?.message || `Failed to ${operation}`, code: 'UNKNOWN' } };
};

/** Expanded SELECT so we can mirror provider details in your table */
const baseSelect = `
  id, team_id, card_name, last_four, is_default, created_by, created_at,
  provider, provider_customer_id, provider_payment_method_id,
  brand, exp_month, exp_year, billing_zip,
  created_by_profile:user_profiles!created_by(id, first_name, last_name, email),
  team:teams(name, sport)
`;

/** ----------------------------------------------------------------------
 * DB helpers (single source of truth for your UI)
 * --------------------------------------------------------------------- */
const db = {
  async listPaymentMethods(teamId = null) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      let q = supabase.from('payment_methods')
        .select(baseSelect)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (teamId) q = q.eq('team_id', teamId);

      const { data, error } = await q;
      if (error) return handleServiceError(error, 'fetch payment methods');
      return { data: data || [], error: null };
    } catch (error) {
      return handleServiceError(error, 'fetch payment methods');
    }
  },

  async createPaymentMethod(row) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .insert([row])
        .select(baseSelect)
        .single();
      if (error) return handleServiceError(error, 'create payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'create payment method');
    }
  },

  async upsertPaymentMethods(rows = []) {
    try {
      if (!rows.length) return { data: [], error: null };
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .upsert(rows, { onConflict: 'provider_payment_method_id' })
        .select(baseSelect);
      if (error) return handleServiceError(error, 'upsert payment methods');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'upsert payment methods');
    }
  },

  async updatePaymentMethod(id, updates) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      const { data, error } = await supabase
        .from('payment_methods')
        .update(updates)
        .eq('id', id)
        .select(baseSelect)
        .single();
      if (error) return handleServiceError(error, 'update payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'update payment method');
    }
  },

  async deletePaymentMethod(id) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');

      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) return handleServiceError(error, 'delete payment method');
      return { error: null };
    } catch (error) {
      return handleServiceError(error, 'delete payment method');
    }
  },

  async setDefaultPaymentMethod(id, teamId) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Authentication required');
      await supabase.from('payment_methods').update({ is_default: false }).eq('team_id', teamId);
      const { data, error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id)
        .select(baseSelect)
        .single();
      if (error) return handleServiceError(error, 'set default payment method');
      return { data, error: null };
    } catch (error) {
      return handleServiceError(error, 'set default payment method');
    }
  },
};

/** ----------------------------------------------------------------------
 * Stripe adapter (real; used when VITE_PAYMENTS_MOCK=0)
 * --------------------------------------------------------------------- */
const stripeAdapter = {
  id: 'stripe',

  async startSetup({ customerId, successUrl, cancelUrl }) {
    const res = await fetch('/api/stripe/setup-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, successUrl, cancelUrl }),
    });
    if (!res.ok) throw new Error('Failed to start Stripe setup');
    const json = await res.json(); // { url }
    return { kind: 'redirect', url: json.url };
  },

  async startCheckout({ customerId, lineItems, metadata, successUrl, cancelUrl }) {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, lineItems, metadata, successUrl, cancelUrl }),
    });
    if (!res.ok) throw new Error('Failed to start Stripe checkout');
    const json = await res.json(); // { url }
    return { kind: 'redirect', url: json.url };
  },

  async startPortal({ customerId, returnUrl }) {
    const res = await fetch('/api/stripe/portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId, returnUrl }),
    });
    if (!res.ok) throw new Error('Failed to open Stripe portal');
    const json = await res.json(); // { url }
    return { kind: 'redirect', url: json.url };
  },

  async listSavedMethods({ teamId }) {
    return db.listPaymentMethods(teamId);
  },

  async deleteSavedMethod({ dbId /*, stripePmId*/ }) {
    return db.deletePaymentMethod(dbId);
  },
};

/** ----------------------------------------------------------------------
 * MealMe adapter (real; used when VITE_PAYMENTS_MOCK=0)
 * --------------------------------------------------------------------- */
const mealmeAdapter = {
  id: 'mealme',

  async startCheckout({ orderInput }) {
    const response = await mealmeApi.getPaymentIntent(orderInput);
    const payload = response?.result || response;
    if (!payload?.client_secret) throw new Error('MealMe: missing client_secret');
    return {
      kind: 'elements',
      clientSecret: payload?.client_secret,
      publishableKey: payload?.publishable_key,
      orderId: payload?.order_id,
      stripeIntentId: payload?.payment_intent_id,
    };
  },

  async listSavedMethods({ teamId, userId, email }) {
    try {
      const result = await mealmeApi.listPaymentMethods({ user_id: userId, user_email: email });
      const rows = (result?.payment_methods || result?.result?.payment_methods || []).map((pm) => ({
        team_id: teamId || null,
        card_name: pm.nickname || pm.label || 'Card',
        last_four: String(pm.last4 || pm.card_last4 || '').slice(-4),
        is_default: Boolean(pm.is_default),
        provider: 'mealme',
        provider_customer_id: pm.customer_id || null,
        provider_payment_method_id: pm.id,
        brand: (pm.brand || pm.card_brand || 'card').toLowerCase(),
        exp_month: pm.exp_month || null,
        exp_year: pm.exp_year || null,
        billing_zip: pm.billing_zip || null,
      }));
      if (rows.length) await db.upsertPaymentMethods(rows);
    } catch (error) {
      console.warn('MealMe listSavedMethods failed, falling back to DB:', error?.message || error);
    }
    return db.listPaymentMethods(teamId);
  },

  async deleteSavedMethod({ dbId, mealmePaymentMethodId, userId, email }) {
    try {
      await mealmeApi.deletePaymentMethod({
        payment_method_id: mealmePaymentMethodId,
        user_id: userId,
        user_email: email,
      });
    } finally {
      if (dbId) await db.deletePaymentMethod(dbId);
    }
    return { error: null };
  },
};

/** ----------------------------------------------------------------------
 * MOCK adapter (dev scaffolding; no network calls at all)
 * --------------------------------------------------------------------- */
const uid = (p = 'pm_mock_') => p + Math.random().toString(36).slice(2, 10);

const mockAdapter = {
  id: 'mock',

  async listSavedMethods({ teamId }) {
    // Just read whatever is in your DB
    return db.listPaymentMethods(teamId);
  },

  async startSetup() {
    // No-op: we don't actually collect cards in mock mode
    return { kind: 'mock' };
  },

  async startCheckout() {
    // No-op: your UI will treat this as instant success
    return { kind: 'mock', orderId: uid('order_') };
  },

  async deleteSavedMethod({ dbId }) {
    return db.deletePaymentMethod(dbId);
  },

  async createFakeCard({ teamId = null, isDefault = false, brand = 'visa', last4 = '4242' }) {
    const expYear = new Date().getFullYear() + 2;
    const row = {
      team_id: teamId,
      card_name: 'Test Card',
      last_four: last4,
      is_default: !!isDefault,
      provider: 'mock',
      provider_customer_id: null,
      provider_payment_method_id: uid(), // unique
      brand,
      exp_month: 12,
      exp_year: expYear,
      billing_zip: '00000',
    };
    const { data, error } = await db.createPaymentMethod(row);
    if (error) return { data: null, error };
    if (isDefault && data?.id) await db.setDefaultPaymentMethod(data.id, teamId);
    return { data, error: null };
  },
};

const ADAPTERS = { stripe: stripeAdapter, mealme: mealmeAdapter, mock: mockAdapter };

/** Choose adapter. If FORCE_MOCK, always use mock. */
const pick = (provider) => {
  if (FORCE_MOCK) return mockAdapter;
  const key = (provider || ENV_PROVIDER || DEFAULT_PROVIDER).toLowerCase();
  if (key === 'mealme' && !featureFlags.mealMeEnabled) return stripeAdapter;
  return ADAPTERS[key] || ADAPTERS[DEFAULT_PROVIDER] || stripeAdapter;
};

/** ----------------------------------------------------------------------
 * Public surface
 * --------------------------------------------------------------------- */
export const paymentService = {
  /** Setup flow (Stripe only). Mock returns no-op. */
  async startSetup(opts = {}) {
    const adapter = pick(opts.provider);
    if (adapter.id === 'stripe') {
      return adapter.startSetup({
        customerId: opts.customerId,
        successUrl: opts.successUrl,
        cancelUrl: opts.cancelUrl,
      });
    }
    return adapter.startSetup?.(opts) ?? { kind: 'unsupported' };
  },

  /** Read saved methods for UI */
  async getPaymentMethods(teamId = null, opts = {}) {
    const adapter = pick(opts.provider);
    if (adapter.id === 'mealme' && !FORCE_MOCK) {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email || opts.email;
      const userId = session?.user?.id || opts.userId;
      return adapter.listSavedMethods({ teamId, userId, email });
    }
    return adapter.listSavedMethods({ teamId });
  },

  /** Hosted "add card" (Stripe), otherwise unsupported; mock inserts a fake card */
  async startAddCardFlow(opts = {}) {
    const adapter = pick(opts.provider);
    if (adapter.id === 'stripe' && !FORCE_MOCK) {
      return stripeAdapter.startAddCard({
        customerId: opts.customerId,
        successUrl: opts.successUrl,
        cancelUrl: opts.cancelUrl,
      });
    }
    return { kind: 'unsupported' };
  },

  /** Hosted portal (Stripe only) */
  async openManagePortal(opts = {}) {
    const adapter = pick(opts.provider);
    if (adapter.id !== 'stripe' || FORCE_MOCK) return { kind: 'unsupported' };
    return adapter.startPortal({ customerId: opts.customerId, returnUrl: opts.returnUrl });
  },

  /** Start a checkout (MealMe → Elements, Stripe → redirect, Mock → instant success) */
  async startCheckout(orderCtx, opts = {}) {
    const adapter = pick(opts.provider);
    if (adapter.id === 'stripe' && !FORCE_MOCK) {
      return adapter.startCheckout({
        customerId: opts.customerId,
        lineItems: orderCtx?.lineItems,
        metadata: orderCtx?.metadata,
        successUrl: orderCtx?.successUrl,
        cancelUrl: orderCtx?.cancelUrl,
      });
    }
    if (adapter.id === 'mealme' && !FORCE_MOCK) {
      return adapter.startCheckout({ orderInput: orderCtx?.mealmePayload });
    }
    // mock
    return mockAdapter.startCheckout();
  },

  /** Delete a saved method */
  async deletePaymentMethod({ dbId, provider, mealmePaymentMethodId, userId, email }) {
    const adapter = pick(provider);
    if (adapter.id === 'mealme' && !FORCE_MOCK) {
      return adapter.deleteSavedMethod({ dbId, mealmePaymentMethodId, userId, email });
    }
    return db.deletePaymentMethod(dbId);
  },

  /** Mark default locally */
  async setDefaultPaymentMethod(id, teamId) {
    return db.setDefaultPaymentMethod(id, teamId);
  },

  /** Mock helper to insert a fake card directly into your DB */
  async mockAddCard({ teamId = null, isDefault = false, brand, last4 } = {}) {
    if (!FORCE_MOCK) return { error: { message: 'Not in mock mode' } };
    return mockAdapter.createFakeCard({ teamId, isDefault, brand, last4 });
  },

  /** Legacy direct DB calls */
  async createPaymentMethod(row) { return db.createPaymentMethod(row); },
  async updatePaymentMethod(id, updates) { return db.updatePaymentMethod(id, updates); },
  async getTeamPaymentMethods(teamId) { return db.listPaymentMethods(teamId); },

  /** Introspection */
  isMock() { return FORCE_MOCK; },
  activeProviderId(provider) { return pick(provider).id; },
};

/** Optional: UI hints */
export const PROVIDER_CONFIG = {
  stripe:  { paymentMode: 'self_hosted' },
  mealme:  { paymentMode: 'self_hosted_elements' },
  doordash:{ paymentMode: 'external_redirect' },
  ubereats:{ paymentMode: 'external_redirect' },
  grubhub: { paymentMode: 'external_redirect' },
  ezcater: { paymentMode: 'external_redirect' },
};
