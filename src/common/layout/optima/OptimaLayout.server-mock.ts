import type * as React from 'react';


/**
 * `next dev` server compiler only (next.config.ts): stands in for OptimaLayout, which the single-tab gate (ProviderSingleTab)
 * never renders on the server. Being rendered means a page bypasses the gate: fail the render loudly.
 */
export function OptimaLayout(_props: { suspendAutoModelsSetup?: boolean, children: React.ReactNode }): never {
  throw new Error('[DEV] OptimaLayout rendered on the server, but next dev compiles OptimaLayout.server-mock in its place: this page bypasses the single-tab gate - drop its exemption or the mock in next.config.ts');
}
