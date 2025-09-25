// src/services/mealmeApi.js
import { supabase } from '../lib/supabase';
import { mealMeConfig } from '../config/runtimeConfig';

const normalizePath = (template = '', params = {}) => {
  if (!template) throw new Error('MealMe endpoint template missing');
  const replacements = {
    version: mealMeConfig.apiVersion,
    apiVersion: mealMeConfig.apiVersion,
    ...params,
  };
  const replaced = template.replace(/\{(\w+)\}/g, (full, key) => {
    const val = replacements[key];
    return val != null ? String(val) : full;
  });
  if (/^https?:\/\//i.test(replaced)) return replaced;
  if (!replaced.startsWith('/')) return `/${replaced}`;
  return replaced;
};

const invokeProxy = async ({ path, method = 'GET', query, body, headers, timeoutMs }) => {
  const payload = {
    method,
    path,
    query,
    body,
    headers,
    timeoutMs: timeoutMs ?? mealMeConfig.defaultTimeoutMs,
  };

  const { data, error } = await supabase.functions.invoke(mealMeConfig.supabaseFunctionName, {
    body: payload,
  });

  if (error) {
    const message = error.message || 'MealMe proxy error';
    throw new Error(message);
  }

  if (!data) return null;
  if (data.error) {
    const errMsg = typeof data.error === 'string' ? data.error : data.error?.message;
    const errCode = data.error?.code;
    const message = errMsg || 'MealMe API error';
    const err = new Error(message);
    if (errCode) err.code = errCode;
    err.details = data.error;
    throw err;
  }

  return data.result ?? data.data ?? data;
};

const postJson = (path, body, opts = {}) =>
  invokeProxy({ path, method: 'POST', body, headers: { 'Content-Type': 'application/json' }, ...opts });

const getJson = (path, query, opts = {}) =>
  invokeProxy({ path, method: 'GET', query, headers: { Accept: 'application/json' }, ...opts });

const deleteJson = (path, body, opts = {}) =>
  invokeProxy({ path, method: 'DELETE', body, headers: { 'Content-Type': 'application/json' }, ...opts });

export const mealmeApi = {
  resolvePath: normalizePath,

  async geocodeAddress(address, opts = {}) {
    if (!address) throw new Error('Address is required');
    const path = normalizePath(mealMeConfig.endpoints.geocode);
    return postJson(path, { address }, opts);
  },

  async reverseGeocode({ latitude, longitude }, opts = {}) {
    if (latitude == null || longitude == null) {
      throw new Error('Latitude and longitude required');
    }
    const path = normalizePath(mealMeConfig.endpoints.reverseGeocode);
    return postJson(path, { latitude, longitude }, opts);
  },

  async searchRestaurants(params = {}, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.restaurantSearch);
    return postJson(path, params, opts);
  },

  async fetchRestaurantMenu(providerRestaurantId, opts = {}) {
    if (!providerRestaurantId) throw new Error('providerRestaurantId required');
    const path = normalizePath(mealMeConfig.endpoints.restaurantMenu, { restaurantId: providerRestaurantId });
    return getJson(path, { provider_restaurant_id: providerRestaurantId }, opts);
  },

  async createCart(payload = {}, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.carts);
    return postJson(path, payload, opts);
  },

  async addItemToCart(cartId, payload = {}, opts = {}) {
    if (!cartId) throw new Error('cartId required');
    const path = normalizePath(mealMeConfig.endpoints.cartItems, { cartId });
    return postJson(path, { ...payload, cart_id: cartId }, opts);
  },

  async removeItemFromCart(cartId, payload = {}, opts = {}) {
    if (!cartId) throw new Error('cartId required');
    const path = normalizePath(mealMeConfig.endpoints.cartItems, { cartId });
    return deleteJson(path, { ...payload, cart_id: cartId }, opts);
  },

  async createOrderDraft(orderInput, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.orderDraft);
    return postJson(path, orderInput, opts);
  },

  async finalizeOrder(orderId, opts = {}) {
    if (!orderId) throw new Error('orderId required');
    const path = normalizePath(mealMeConfig.endpoints.orderFinalize);
    return postJson(path, { order_id: orderId }, opts);
  },

  async getPaymentIntent(payload, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.paymentIntent);
    return postJson(path, payload, opts);
  },

  async listPaymentMethods(payload, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.paymentMethodsList);
    return postJson(path, payload, opts);
  },

  async deletePaymentMethod(payload, opts = {}) {
    const path = normalizePath(mealMeConfig.endpoints.paymentMethodsDelete);
    return postJson(path, payload, opts);
  },
};
