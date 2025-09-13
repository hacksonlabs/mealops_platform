// src/services/providerService.js
const providerService = {
  async startCheckout({ provider, cartId, providerRestaurantId }) {
    switch (provider) {
      case 'mealme':
        // TODO: call your server/edge function -> returns hosted checkout URL
        // return mealmeService.createCheckout(cartId, providerRestaurantId);
        return `/coming-soon?provider=mealme&cart=${cartId}`;
      case 'doordash':
        // TODO: create deep link or store URL
        return `/coming-soon?provider=doordash&cart=${cartId}`;
      case 'ubereats':
        return `/coming-soon?provider=ubereats&cart=${cartId}`;
      case 'grubhub':
        return `/coming-soon?provider=grubhub&cart=${cartId}`;
      default:
        return `/coming-soon?provider=${encodeURIComponent(provider)}&cart=${cartId}`;
    }
  },
};

export default providerService;