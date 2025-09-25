// src/services/menuProviderService.js
import { supabase } from '../lib/supabase';
import { featureFlags } from '../config/runtimeConfig';
import { mealmeApi } from './mealmeApi';

// priority: mealme > grubhub > ubereats > doordash
export const PROVIDER_PRIORITY = ['mealme','grubhub','ubereats','doordash'];

const MULTIPLIERS = {
  mealme: 1.00,
  grubhub: 1.00,
  ubereats: 1.07,
  doordash: 1.09,
};

// ---- HARD CODED multi-provider mock for ONE demo restaurant ----
// Only includes overrides for a couple items; everything else comes from DB.
const MULTI_DEMO_BY_PROVIDER = {
  grubhub: [
    { key:'Margherita Pizza', price:16.99, description:'GH price' },
    { key:'Caesar Salad',     price:12.49, description:'GH price' },
  ],
  ubereats: [
    { key:'Margherita Pizza', price:16.49, description:'UE price' },
    { key:'Caesar Salad',     price:12.29, description:'UE price' },
  ],
  doordash: [
    { key:'Margherita Pizza', price:16.79, description:'DD price' },
    { key:'Caesar Salad',     price:12.39, description:'DD price' },
  ],
};

// Helpers
const toCents = n => Math.round(Number(n) * 100);
const fromCents = c => Math.round(Number(c)) / 100;

function applyMultiplier(price, provider) {
  const mult = MULTIPLIERS[provider] ?? 1.0;
  return fromCents(Math.round(toCents(price || 0) * mult));
}

async function fetchDbMenu(restaurantId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map(r => ({
    // keep DB ids (useful for edit flow), with a provider tag if you need uniqueness later
    id: r.id,
    name: r.name,
    description: r.description || '',
    category: r.category || 'Menu',
    image: r.image_url || '',
    price: Number(r.price ?? 0),
    options: r.options_json || null,
    sizes: r.sizes_json || [],
    toppings: r.toppings_json || [],
    api_id: r.api_id || null,
  }));
}

// Merge strategy: DB items are the base; if a provider override matches by
// name (or api_id), override price/description for those items only.
function mergeOverrides(dbItems, provider, overrides) {
  if (!overrides?.length) return dbItems.map(it => ({
    ...it,
    price: applyMultiplier(it.price, provider),
  }));

  // Build a quick lookup by name and api_id
  const byName = new Map(overrides.map(o => [o.key?.toLowerCase(), o]));
  const byApi  = new Map(overrides.filter(o => o.api_id).map(o => [o.api_id, o]));

  return dbItems.map(it => {
    const o =
      (it.api_id && byApi.get(it.api_id)) ||
      byName.get(it.name?.toLowerCase());
    if (!o) {
      // no explicit override -> apply multiplier only
      return { ...it, price: applyMultiplier(it.price, provider) };
    }
    // override fields if present on the override record
    return {
      ...it,
      price: o.price != null ? Number(o.price) : applyMultiplier(it.price, provider),
      description: o.description ?? it.description,
      // you can also override images/categories if you add them to the override
    };
  });
}

// --- Real-provider adapter interface (stubbed for now) ---
// When you integrate partners, implement these to call their APIs.
const providerAdapters = {
  grubhub: {
    fetchMenu: async (providerRestaurantId) => {
      // TODO: call GH API with providerRestaurantId
      // return items in your normalized schema
      return null; // null => use fallback merge
    },
  },
  ubereats: {
    fetchMenu: async (providerRestaurantId) => {
      // TODO
      return null;
    },
  },
  doordash: {
    fetchMenu: async (providerRestaurantId) => {
      // TODO
      return null;
    },
  },
};

if (featureFlags.mealMeEnabled) {
  providerAdapters.mealme = {
    fetchMenu: async (providerRestaurantId) => {
      if (!providerRestaurantId) return null;
      try {
        const response = await mealmeApi.fetchRestaurantMenu(providerRestaurantId);
        const items = response?.items
          || response?.menu_items
          || response?.data?.items
          || response?.data?.menu_items
          || [];
        if (!Array.isArray(items) || !items.length) return null;
        return items.map((item) => {
          const priceCents = item.price_cents ?? item.priceCents ?? null;
          const basePrice = priceCents != null
            ? Number(priceCents) / 100
            : Number(item.price ?? item.base_price ?? 0);
          return {
            id: item.id || item.item_id || item.external_id,
            name: item.name || item.title || 'Item',
            description: item.description || item.subtitle || '',
            category: item.category || item.section || 'Menu',
            image: item.image_url || item.photo_url || '',
            price: basePrice,
            options: item.options || item.modifiers || item.selected_options || null,
            sizes: item.sizes || [],
            toppings: item.toppings || [],
            api_id: item.provider_item_id || item.id || null,
          };
        });
      } catch (error) {
        console.warn('MealMe fetchMenu failed:', error?.message || error);
        return null;
      }
    },
  };
}

export async function fetchMenu({ provider, restaurant }) {
  const providers = restaurant?.supported_providers || ['grubhub'];
  const providerId = restaurant?.provider_restaurant_ids?.[provider] || null;

  // 1) If we have a real adapter and provider id, try the live provider first.
  const adapter = providerAdapters[provider];
  if (adapter && providerId) {
    try {
      const live = await adapter.fetchMenu(providerId);
      if (Array.isArray(live) && live.length) {
        return live;
      }
    } catch (e) {
      console.warn(`Provider ${provider} adapter failed, falling back:`, e);
    }
  }

  // 2) Fallback to DB + multiplier + (optional) overrides for multi-provider demo
  const dbItems = await fetchDbMenu(restaurant.id);

  // If restaurant has more than one provider, apply the small override set (to simulate differences)
  const hasMulti = (providers?.length || 0) > 1;
  if (hasMulti) {
    const overrides = MULTI_DEMO_BY_PROVIDER[provider] || [];
    return mergeOverrides(dbItems, provider, overrides);
  }

  // Single-provider restaurant -> just multiplier (and default provider = grubhub)
  return dbItems.map(it => ({ ...it, price: applyMultiplier(it.price, 'grubhub') }));
}

export function pickDefaultProvider(providers = []) {
  if (!providers.length) return 'grubhub';
  for (const p of PROVIDER_PRIORITY) if (providers.includes(p)) return p;
  return providers[0];
}
