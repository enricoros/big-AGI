import { Release } from '~/common/app.release';

import type { ModelVendorId } from './vendors/vendors.registry';
import { LLMS_DEFS_VERSIONS } from './server/gen/llms.defs.versions';
import { llmsDeepseekWire, llmsIsNativeOpenAIHost } from './shared/llm.isomorphic';


/**
 * The model-defs version a service compares its `defsV` stamp against: the vendor bucket's
 * content-derived version (see llms.defs.manifest.ts) with the AIX monotonic folded in, so an
 * AIX roll still refreshes every service. Custom-host OpenAI services (lookalike gateways,
 * proxies) follow `_openaiCompat` rather than `openai`. A DeepSeek service is listed by the wire it
 * speaks (its web tools are on Messages only), so the wire is in its version: a change of API Protocol
 * or host that changes the wire re-lists it.
 */
export function llmsDefsVersionFor(vendorId: ModelVendorId, serviceSetup: Record<string, any> | undefined): string {
  const bucket = (vendorId === 'openai' && !llmsIsNativeOpenAIHost(serviceSetup?.oaiHost || undefined)) ? '_openaiCompat' : vendorId;
  const wire = (vendorId === 'deepseek' && llmsDeepseekWire(serviceSetup?.deepseekProtocol || undefined, serviceSetup?.deepseekHost || undefined) !== 'messages') ? '-cc' : '';
  return `${LLMS_DEFS_VERSIONS[bucket]}${wire}-a${Release.Monotonics.Aix}`;
}
