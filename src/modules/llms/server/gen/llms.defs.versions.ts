// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '68374c5d3ee5',
  _shared: '68133b8c1f89',
  alibaba: 'a491f6689eea',
  anthropic: '50fac522d99a',
  azure: 'a6c0bb3feb9c',
  bedrock: 'a5021aab9fa0',
  cerebras: '5d9a05eafc9b',
  cohere: '244b4ec3d312',
  deepseek: 'b064e339342b',
  googleai: '51e9ca12c8ce',
  groq: 'a856ddef75ae',
  lmstudio: 'b8278679587e',
  localai: '169ef5505991',
  metaai: '1b6b8bae32fc',
  mistral: '2e01697d38f2',
  modular: '26c6199d4ec6',
  moonshot: 'f3ae4f6c5fdb',
  nvidianim: '34525f64e8b9',
  ollama: '9a5e5d9e4120',
  openai: '1724cecc51da',
  openrouter: '8ac277ffd550',
  perplexity: 'c0ad305f4551',
  sakanaai: '440b7e29b85e',
  togetherai: '905a49db1830',
  xai: '97e3bc7b9c28',
  zai: '03fe05e23314',
} as const satisfies LlmsDefsVersions;
