// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'f5eb0ec2e0cd',
  _shared: '7d6dcb3d6d22',
  alibaba: '57f37ae8ac13',
  anthropic: 'dfbf94d929d2',
  azure: '4578985e301f',
  bedrock: '06fec599b8c7',
  cerebras: 'b4717891b83e',
  cohere: '74bf6bb98b71',
  deepseek: '3e8c7858541f',
  googleai: '810e357f08fb',
  groq: 'd44c1e9fd371',
  lmstudio: 'bcb6acc32732',
  localai: '66e8a667f374',
  metaai: '15248e830bfc',
  mistral: '582eb9a69d44',
  modular: '1ceb448ed638',
  moonshot: '03fd8c53bc68',
  nvidianim: '7cfb0959565e',
  ollama: 'e363529720b0',
  openai: 'a0cc6998a77e',
  openrouter: 'e818e117b52d',
  perplexity: 'bcec14587b2c',
  sakanaai: '4bb64855a42f',
  togetherai: '5ac1681669aa',
  xai: 'bff3f6cb385c',
  zai: '915e560d7d58',
} as const satisfies LlmsDefsVersions;
