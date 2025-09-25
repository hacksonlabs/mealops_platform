// src/config/runtimeConfig.js
const bool = (value, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

const mealMeEnv = (import.meta?.env?.VITE_MEALME_ENV || 'sandbox').toLowerCase();
const mealMeBaseUrlEnv = import.meta?.env?.VITE_MEALME_BASE_URL;

const baseUrls = {
  sandbox: 'https://api-sandbox.mealme.ai',
  production: 'https://api.mealme.ai',
  staging: 'https://api-staging.mealme.ai',
};

export const runtimeConfig = {
  featureFlags: {
    mealMeEnabled: bool(import.meta?.env?.VITE_FEATURE_MEALME ?? import.meta?.env?.VITE_MEALME_ENABLED, false),
    ordersMock: bool(import.meta?.env?.VITE_ORDERS_MOCK, true),
    paymentsMock: bool(import.meta?.env?.VITE_PAYMENTS_MOCK, true),
  },
  mealMe: {
    environment: baseUrls[mealMeEnv] ? mealMeEnv : 'sandbox',
    baseUrl: mealMeBaseUrlEnv?.trim() || baseUrls[baseUrls[mealMeEnv] ? mealMeEnv : 'sandbox'],
    supabaseFunctionName: import.meta?.env?.VITE_MEALME_FUNCTION_NAME || 'mealme-proxy',
    defaultTimeoutMs: Number(import.meta?.env?.VITE_MEALME_TIMEOUT_MS || 15000),
    apiVersion: import.meta?.env?.VITE_MEALME_API_VERSION || 'v1',
    endpoints: {
      geocode: import.meta?.env?.VITE_MEALME_ENDPOINT_GEOCODE || '/maps/geocode',
      reverseGeocode: import.meta?.env?.VITE_MEALME_ENDPOINT_REVERSE_GEOCODE || '/maps/reverse-geocode',
      restaurantSearch: import.meta?.env?.VITE_MEALME_ENDPOINT_RESTAURANTS || '/discovery/search',
      restaurantMenu: import.meta?.env?.VITE_MEALME_ENDPOINT_MENU || '/catalog/menu',
      carts: import.meta?.env?.VITE_MEALME_ENDPOINT_CARTS || '/carts',
      cartItems: import.meta?.env?.VITE_MEALME_ENDPOINT_CART_ITEMS || '/carts/{cartId}/items',
      orderDraft: import.meta?.env?.VITE_MEALME_ENDPOINT_ORDER_DRAFT || '/order/order/v4',
      orderFinalize: import.meta?.env?.VITE_MEALME_ENDPOINT_ORDER_FINALIZE || '/order/finalize',
      paymentIntent: import.meta?.env?.VITE_MEALME_ENDPOINT_PAYMENT_INTENT || '/order/payment-intent',
      paymentMethodsList: import.meta?.env?.VITE_MEALME_ENDPOINT_PAYMENT_LIST || '/payment-method/list',
      paymentMethodsDelete: import.meta?.env?.VITE_MEALME_ENDPOINT_PAYMENT_DELETE || '/payment-method/delete',
    },
  },
};

export const featureFlags = runtimeConfig.featureFlags;
export const mealMeConfig = runtimeConfig.mealMe;

export const isMealMeEnabled = () => featureFlags.mealMeEnabled;
