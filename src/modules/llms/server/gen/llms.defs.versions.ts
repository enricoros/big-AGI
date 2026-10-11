// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'b5b7da057936',
  _shared: '68133b8c1f89',
  alibaba: 'cfe761129f26',
  anthropic: '50fac522d99a',
  azure: 'a6c0bb3feb9c',
  bedrock: 'a5021aab9fa0',
  cerebras: '5d9a05eafc9b',
  cohere: '244b4ec3d312',
  deepseek: 'b064e339342b',
  googleai: '51e9ca12c8ce',
  groq: 'a5fa4dd1d8b7',
  lmstudio: 'b8278679587e',
  localai: '169ef5505991',
  metaai: '168fb30e1a09',
  mistral: '2e01697d38f2',
  modular: '8eddb3438263',
  moonshot: '82c1ddb20bc0',
  nvidianim: '09a145e95785',
  ollama: 'cd4086343dc2',
  openai: '1724cecc51da',
  openrouter: '7e1b780f385e',
  perplexity: 'c0ad305f4551',
  sakanaai: '440b7e29b85e',
  togetherai: '0fdf850d40c9',
  xai: '97e3bc7b9c28',
  zai: '03fe05e23314',
} as const satisfies LlmsDefsVersions;
