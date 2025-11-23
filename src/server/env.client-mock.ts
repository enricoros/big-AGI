/**
 * Client-side stub for env.server.ts - used by webpack to replace env.server.ts in client bundles
 *
 * This mock provides safe defaults for isomorphic code that may access env variables.
 * SECURITY: All server-side secrets return empty strings on the client (which is safe and expected).
 */

// [server-side] throw immediately if imported
if (typeof window === 'undefined')
  throw new Error('[DEV] env.client-mock: client module should never be imported on the server.');


// configuration
const LOG_ENV_ACCESS = false;


// -- [client-side] stub exports matching env.server.ts interface --

export const env = !LOG_ENV_ACCESS ? {} as any : new Proxy({} as any, {

  get(_target, prop) {
    const propName = String(prop);
    if (propName !== '$$typeof')
      console.log(`[env.client-mock] env.${propName} → undefined`);
    return undefined;
  },

});
