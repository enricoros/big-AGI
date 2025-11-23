/**
 * Client-side stub for env.server.ts - used by webpack to replace env.server.ts in client bundles
 */

// [server-side] throw immediately if imported
if (typeof window === 'undefined')
  throw new Error('[DEV] env.client-mock: client module should never be imported on the server.');

// [client-side] stub exports matching env.server.ts interface
export const env = new Proxy({} as any, {

  get(_target, prop) {
    throw new Error(`[DEV] env.client-mock: client shall not access server env.${String(prop)}`);
  },

});
