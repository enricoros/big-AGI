/**
 * Trade adapters for the values the app keeps in localStorage: settings and credentials.
 *
 * A stored value has no history: a different value in the file replaces this device's, and a store
 * the file does not hold is left as it is. Writes take effect at the next load.
 */

import type { TradeAdapter, TradeItem, TradeRejected, TradeSection } from '../trade.types';
import { tradeRelateByContent } from '../trade.plan';


// The stores an export holds. A store that is not listed stays on its device: view state, identity, sessions, logs.
// Never to be listed: the shared chat links ('app-sharing'), the open panes, the sign-in cache, the analytics
// client's 'ph_*'. The device backup leaves the same ones out, by name (BackupRestore.tsx).
const STORES: Record<string, { group: 'settings' | 'credentials', title: string }> = {
  'app-ui': { group: 'settings', title: 'Appearance and layout' },
  'joy-mode': { group: 'settings', title: 'Light or dark theme' },
  'joy-color-scheme-light': { group: 'settings', title: 'Light theme' },
  'joy-color-scheme-dark': { group: 'settings', title: 'Dark theme' },
  'app-app-chat': { group: 'settings', title: 'Chat preferences' },
  'app-app-call': { group: 'settings', title: 'Call preferences' },
  'app-ai-preferences': { group: 'settings', title: 'AI preferences' },
  'app-ux-labs': { group: 'settings', title: 'Labs' },
  'app-module-beam': { group: 'settings', title: 'Beam presets and preferences' },
  'app-purpose': { group: 'settings', title: 'Hidden personas' },
  'app-app-personas': { group: 'settings', title: 'Personas made with the Persona Creator' },
  'app-news-seen': { group: 'settings', title: 'News already seen' },
  'app-models': { group: 'credentials', title: 'AI services, models and API keys' },
  'app-module-speex': { group: 'credentials', title: 'Voice services and keys' },
  'app-module-asrx': { group: 'credentials', title: 'Transcription services and keys' },
  'app-module-t2i': { group: 'credentials', title: 'Image services and keys' },
  'app-module-google-search': { group: 'credentials', title: 'Google Search key' },
  'app-module-browse': { group: 'credentials', title: 'Browsing endpoint' },
};

const SCHEMA_STORE_VALUE = 'store-value'; // the value persisted under the store name: for zustand stores '{ state, version }', which the store migrates at load
const NO_KEYS: ReadonlySet<string> = new Set();


/** The stored values of a device backup as the sections these adapters read, and the names of the ones that are not exportable. */
export function tradeStoreValueSections(values: Record<string, unknown>): { sections: TradeSection[], notExportable: string[] } {
  const sections = (['settings', 'credentials'] as const)
    .map(group => ({
      type: group,
      schema: SCHEMA_STORE_VALUE,
      items: Object.keys(values).filter(key => STORES[key]?.group === group).map(key => ({ id: key, data: values[key] })),
    }))
    .filter(section => section.items.length);
  return { sections, notExportable: Object.keys(values).filter(key => !(key in STORES)) };
}


export function tradeSettingsAdapters(): TradeAdapter[] {
  return [
    _storeValuesAdapter('settings', 'setting', 'settings'),
    { ..._storeValuesAdapter('credentials', 'credential', 'credentials'), secrets: true },
  ];
}

function _storeValuesAdapter(group: 'settings' | 'credentials', label: string, labelPlural: string): TradeAdapter {
  return {
    type: group,
    label,
    labelPlural,
    schema: SCHEMA_STORE_VALUE,
    appliesOnReload: true,

    localItems: async () => {
      const items: TradeItem[] = [];
      for (const key in STORES) {
        if (STORES[key].group !== group) continue;
        const stored = localStorage.getItem(key);
        if (stored !== null)
          items.push({ id: key, data: _parseStored(stored) });
      }
      return { items };
    },

    readSection: (section, local) => {
      const items: TradeItem[] = [];
      const rejected: TradeRejected[] = [];
      for (const item of section.items) {
        const here = local.get(item.id);
        if (section.schema !== SCHEMA_STORE_VALUE || STORES[item.id]?.group !== group)
          rejected.push({ id: item.id, reason: 'Not a setting this version knows' });
        else if (!(_storeVersion(item.data) <= (here ? _storeVersion(here.data) : Infinity)))
          rejected.push({ id: STORES[item.id].title, reason: 'Saved by a newer version of Big-AGI' }); // a store migrates forward only
        else
          items.push({ id: item.id, data: item.data });
      }
      return { items, rejected };
    },

    relate: (incoming, local) =>
      tradeRelateByContent(incoming.data, local.data, NO_KEYS).relation === 'same' ? { relation: 'same' } : { relation: 'ahead' },

    describe: (item) => ({ title: STORES[item.id]?.title ?? item.id }),

    apply: async (ops) => {
      const failed: TradeRejected[] = [];
      for (const { item, resolution } of ops) {
        if (resolution !== 'add' && resolution !== 'accept-incoming') continue;
        try {
          localStorage.setItem(item.id, typeof item.data === 'string' ? item.data : JSON.stringify(item.data));
        } catch (error: any) {
          failed.push({ id: STORES[item.id]?.title ?? item.id, reason: error?.message || 'Could not be saved' });
        }
      }
      return { failed };
    },
  };
}

function _parseStored(stored: string): unknown {
  try {
    return JSON.parse(stored);
  } catch {
    return stored; // not every store holds JSON: the theme keys are plain words
  }
}

/** The version a zustand store stamps on its value: -1 where there is none, never comparable where it is not a number. */
function _storeVersion(value: unknown): number {
  if (!value || typeof value !== 'object' || !('version' in value)) return -1;
  return typeof value.version === 'number' ? value.version : NaN;
}
