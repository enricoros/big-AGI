/**
 * Trade adapter for the AI services that the all-chats files embed, API keys included.
 *
 * Import only, and add-only: a service this device already has is kept as it is, and said so.
 * An export holds services as credentials (trade.settings.ts).
 */

import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';

import type { TradeAdapter, TradeItem, TradeRejected } from '../trade.types';


const SCHEMA_SERVICE = 'llms.service';


export function tradeLegacyServicesAdapter(): TradeAdapter {
  return {
    type: 'llm-service',
    label: 'AI service',
    labelPlural: 'AI services',
    schema: SCHEMA_SERVICE,
    importOnly: true,
    secrets: true,

    localItems: async () => ({ items: llmsStoreState().sources.map(service => ({ id: service.id, data: service })) }),

    readSection: (section, local) => {
      const items: TradeItem[] = [];
      const rejected: TradeRejected[] = [];
      for (const item of section.items) {
        const service = item.data as { id?: unknown, vId?: unknown } | null;
        if (section.schema !== SCHEMA_SERVICE || !service || service.id !== item.id || typeof service.vId !== 'string')
          rejected.push({ id: item.id, reason: 'Not an AI service' });
        else if (local.has(item.id))
          rejected.push({ id: item.id, reason: 'Already on this device: kept as it is' });
        else
          items.push({ id: item.id, data: service });
      }
      return { items, rejected };
    },

    // only services that are not here become items
    relate: () => ({ relation: 'same' }),

    describe: (item) => {
      const service = item.data as { label?: unknown, vId: string };
      return { title: typeof service.label === 'string' ? service.label : item.id, detail: service.vId };
    },

    apply: async (ops) => {
      llmsStoreActions().importServicesAppend(ops.filter(op => op.resolution === 'add').map(op => op.item.data as any));
      // the store skips what it cannot add (an AI service type this version does not have) without naming it
      const added = new Set(llmsStoreState().sources.map(service => service.id));
      return {
        failed: ops.filter(op => op.resolution === 'add' && !added.has(op.item.id)).map(op => ({ id: op.item.id, reason: 'Unknown type of AI service' })),
      };
    },
  };
}
