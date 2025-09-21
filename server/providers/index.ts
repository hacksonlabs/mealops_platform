// server/providers/index.ts
import type { Provider } from '../../src/domain/orderTypes';
import type { ProviderAdapter } from './ProviderAdapter';
import { manualAdapter } from './manual/adapter';

const registry: Record<Provider, ProviderAdapter | undefined> = {
  manual: manualAdapter,
  ubereats: undefined,
  grubhub: undefined,
  mealme: undefined,
  doordash: undefined,
  ezcater: undefined,
};

export function getAdapter(p?: string): ProviderAdapter | undefined {
  const key = (p ?? 'manual').toLowerCase() as Provider;
  return registry[key];
}
