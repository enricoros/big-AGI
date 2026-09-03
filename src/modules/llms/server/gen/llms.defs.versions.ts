// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '93199ecde6de',
  _shared: '2daaedce3d6b',
  alibaba: '13549d5b9226',
  anthropic: 'd25418ae3d11',
  azure: '8d5c198b1162',
  bedrock: '0d02b3d9e546',
  cerebras: '207d5cc8d2d0',
  cohere: 'f121dbeff6c6',
  deepseek: '87350bfee48f',
  googleai: 'c348b2f7c731',
  groq: '7f434e266bf7',
  lmstudio: 'e057008b99ce',
  localai: '0cc6b9022023',
  metaai: 'ca6027f701b9',
  mistral: '5b96a7683862',
  modular: 'e5e54a70e5b9',
  moonshot: '4be11e11fdab',
  nvidianim: 'bbadc73717da',
  ollama: '56fbc6c0ef46',
  openai: 'e1e0320e88c2',
  openrouter: '7e5c2f87467f',
  perplexity: '93efb27c3868',
  sakanaai: 'dfbb8a46e3fc',
  togetherai: '34d316d92f85',
  xai: 'd991993d2124',
  zai: '1c1670d60558',
} as const satisfies LlmsDefsVersions;
