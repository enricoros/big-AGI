/**
 * Client-side stub for posthog.server.ts - used by webpack to replace posthog.server.ts in client bundles
 */

// [server-side] throw immediately if imported
if (typeof window === 'undefined')
  throw new Error('[DEV] posthog.client-mock: client module should never be imported on the server.');


// -- [client-side] stub exports matching posthog.server.ts interface --

export const hasPostHogServer = false;

export async function posthogServerSendEvent(): Promise<void> {
  // no-op on client
  throw new Error('[DEV] posthog.client-mock: notImplemented');
}

export async function posthogServerSendException(): Promise<void> {
  // no-op on client
  throw new Error('[DEV] posthog.client-mock: notImplemented');
}

export async function posthogServerShutdown(): Promise<void> {
  // no-op on client
  throw new Error('[DEV] posthog.client-mock: notImplemented');
}
