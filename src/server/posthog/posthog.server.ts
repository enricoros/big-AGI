/**
 * PostHog server-side client for error tracking
 * Replaced with posthog.client-mock.ts on client builds via webpack.
 */
// [client-side] throw immediately if imported
if (typeof window !== 'undefined')
  throw new Error('[DEV] posthog.server: server module should never be imported on the client.');

import { PostHog } from 'posthog-node';

import { Release } from '~/common/app.release';


export const hasPostHogServer = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;


// --- Singleton instance ---

// Singleton instance - PostHog client handles batching internally
let _posthogServer: PostHog | null = null;

function _posthogServerSingleton(): PostHog | null {
  if (!hasPostHogServer) return null;
  if (_posthogServer) return _posthogServer;
  return _posthogServer = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: 'https://us.i.posthog.com', // server exceptions host
    // enableExceptionAutocapture: true, // untested, so disabled for now
    // for server-side, we want immediate flushing
    flushAt: 1,
    flushInterval: 0,
  });
}


// --- Server-Side Event and Exception Capture ---

/**
 * Send server-side custom events to PostHog
 * The posthog-node library automatically uses the right implementation for Edge vs Node.js
 */
export async function posthogServerSendEvent(eventName: string, distinctId: string, properties?: {
  runtime?: 'edge' | 'nodejs';
  $ip?: string; // PostHog property
  $pathname?: string; // PostHog property, URL path for the event
  //$useragent: PostHog user agent string, not needed - keep anonymous
  [key: string]: any;
}): Promise<void> {

  const client = _posthogServerSingleton();
  if (!client) return;

  try {

    const build = Release.buildInfo('backend');

    // immediate variant for serverless environments
    await client.captureImmediate({
      distinctId,
      event: eventName,
      properties: {
        runtime: properties?.runtime || 'nodejs',
        ...properties,
        // Tenant and build context - added to all server events - matches client-side properties
        app_tenant: Release.TenantSlug,
        app_build_hash: build.gitSha || 'unknown',
        app_pkg_version: build.pkgVersion || 'unknown',
      },
    });

  } catch (captureError) {
    // log the product analytics error
    console.warn('[PostHog] Error capturing event:', captureError);
  }
}


/**
 * Send server-side exceptions to PostHog
 * The posthog-node library automatically uses the right implementation for Edge vs Node.js
 */
export async function posthogServerSendException(error: Error | unknown, distinctId: string | undefined, context: {
  runtime: 'edge' | 'nodejs';
  domain: string; // e.g. 'trpc-onerror', which will become `server-trpc-onerror` in $exception_domain
  endpoint: string;
  method?: string;
  url?: string;
  additionalProperties?: Record<string, any>;
}): Promise<void> {

  const client = _posthogServerSingleton();
  if (!client) return;

  try {

    const build = Release.buildInfo('backend');

    // For server exceptions, use a consistent distinctId when no user is provided
    // This groups exceptions by runtime type for better error pattern analysis
    const effectiveDistinctId = distinctId || `server_${context.runtime}_errors`;

    // immediate variant for serverless environments
    await client.captureExceptionImmediate(error, effectiveDistinctId, {
      agi_domain: `server-${context.domain}`,
      agi_runtime: context.runtime,
      // Context properties
      endpoint: context.endpoint,
      method: context.method,
      url: context.url,
      // Tenant and build context (added to all server exceptions)
      app_tenant: Release.TenantSlug,
      app_build_hash: build.gitSha || 'unknown',
      app_pkg_version: build.pkgVersion || 'unknown',
      // Any additional properties
      ...context.additionalProperties,
    });

  } catch (captureError) {
    // log the error analytics error
    console.warn('[PostHog] Error capturing exception:', captureError);
  }
}


/** Flush any pending events to PostHog */
export async function posthogServerShutdown(shutdownTimeoutMs: number = 1000): Promise<void> {
  const client = _posthogServerSingleton();
  if (!client) return;
  try {
    await client.shutdown(shutdownTimeoutMs);
  } catch (flushError) {
    console.warn('[PostHog] Error flushing events:', flushError);
  }
}
