import { Release } from '~/common/app.release';

import type { ModelVendorId } from './vendors/vendors.registry';
import { LLMS_DEFS_VERSIONS } from './server/gen/llms.defs.versions';
import { llmsIsNativeOpenAIHost } from './shared/llm.isomorphic';


/**
 * The model-defs version a service compares its `defsV` stamp against: the vendor bucket's
 * content-derived version (see llms.defs.manifest.ts) with the AIX monotonic folded in, so an
 * AIX roll still refreshes every service. Custom-host OpenAI services (lookalike gateways,
 * proxies) follow `_openaiCompat` rather than `openai`.
 */
export function llmsDefsVersionFor(vendorId: ModelVendorId, serviceSetup: Record<string, any> | undefined): string {
  const bucket = (vendorId === 'openai' && !llmsIsNativeOpenAIHost(serviceSetup?.oaiHost || undefined)) ? '_openaiCompat' : vendorId;
  return `${LLMS_DEFS_VERSIONS[bucket]}-a${Release.Monotonics.Aix}`;
}
