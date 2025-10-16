/**
 * PostHog server-side client for error tracking
 * Automatically uses the right implementation for Edge vs Node.js runtime
 */
import { PostHog } from 'posthog-node';


// Singleton instance - PostHog client handles batching internally
let _posthogServer: PostHog | null = null;

function _getPosthogServer(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (_posthogServer) return _posthogServer;
  return _posthogServer = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: 'https://us.i.posthog.com', // server exceptions host
    // enableExceptionAutocapture: true, // untested, so disabled for now
    // for server-side, we want immediate flushing
    flushAt: 1,
    flushInterval: 0,
  });
}


// Note: captureServerEvent functionality may be added in the future
// For now, we focus on error tracking only


/**
 * Captures an exception to PostHog from server-side code
 * The posthog-node library automatically uses the right implementation for Edge vs Node.js
 */
export async function posthogCaptureServerException(
  error: Error | unknown,
  context: {
    domain: string; // e.g. 'trpc', which will become 'server-trpc'
    runtime: 'edge' | 'nodejs';
    endpoint: string;
    method?: string;
    url?: string;
    distinctId?: string;
    additionalProperties?: Record<string, any>;
  },
): Promise<void> {
  const client = _getPosthogServer();
  if (!client) return;

  try {
    const distinctId = context.distinctId || `server_${context.runtime}_${Date.now()}`;

    // Use the immediate variant for better performance in serverless environments
    await client.captureExceptionImmediate(error, distinctId, {
      agi_domain: `server-${context.domain}`,
      agi_runtime: context.runtime,
      // Context properties
      endpoint: context.endpoint,
      method: context.method,
      url: context.url,
      // Any additional properties
      ...context.additionalProperties,
    });

  } catch (captureError) {
    // Don't throw errors from error tracking itself
    console.error('[PostHog] Error capturing exception:', captureError);
  }
}
