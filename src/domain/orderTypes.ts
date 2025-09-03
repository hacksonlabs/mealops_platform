// src/domain/orderTypes.ts
export type MoneyCents = number;
export type Provider = 'ubereats'|'grubhub'|'mealme'|'doordash'|'ezcater'|'manual';

export interface OrderDraft {
  id: string;
  teamId: string;
  currency: 'USD';
  restaurant: { providerStoreId?: string|null; name: string; address?: string|null };
  fulfillment: {
    method: 'delivery'|'pickup';
    whenISO: string; // scheduled_date
    address?: { line1:string; line2?:string|null; city:string; state:string; zip:string; instructions?:string|null };
  };
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    basePriceCents?: MoneyCents;
    options?: Array<{ name: string; quantity: number; priceCents?: MoneyCents }>;
    notes?: string|null;
  }>;
  tips: { driverTipCents?: MoneyCents; pickupTipCents?: MoneyCents };
}

export interface Quote {
  provider: Provider;
  subtotalCents: MoneyCents;
  feesCents: Record<string, MoneyCents>;
  taxCents: MoneyCents;
  tipCents: MoneyCents;
  totalCents: MoneyCents;
  raw?: any;
}

export interface PlaceResult {
  providerOrderId: string;
  status: 'pending_confirmation'|'confirmed';
  trackingUrl?: string;
  raw?: any;
}

export type CancelResult = 'accepted'|'immediate_cancelled'|'denied'|'unsupported';