// server/providers/ProviderAdapter.ts
import type { OrderDraft, Quote, PlaceResult, CancelResult, Provider } from '../../src/domain/orderTypes';

export interface ProviderAdapter {
  readonly name: Provider;
  readonly supportsCancel: boolean;

  quote(draft: OrderDraft): Promise<Quote>;
  place(draft: OrderDraft, quote?: Quote): Promise<PlaceResult>;
  cancel(providerOrderId: string, reason?: string): Promise<CancelResult>;
//   parseWebhook(req: Request): Promise<{ providerOrderId: string; type: string; payload: any }>; // also verify signature
}
