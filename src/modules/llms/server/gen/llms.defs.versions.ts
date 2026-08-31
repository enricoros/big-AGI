// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '1ac6a6a6d02c',
  _shared: '9418c65ba22d',
  alibaba: '04ebc494385e',
  anthropic: '3457a8e0cb42',
  azure: '858a21566dca',
  bedrock: '23fc1ff06863',
  cerebras: '6397944b89db',
  cohere: 'a3706c143c6a',
  deepseek: '4879f9ce4449',
  googleai: '62ebe89c5def',
  groq: '23d0df0cd09f',
  lmstudio: '85eb57eb8e42',
  localai: '2a8b423c867f',
  mistral: '870e8b290cf9',
  modular: 'd1a73613d3da',
  moonshot: '862b5a9f71bd',
  nvidianim: '1a1eee3fb4ae',
  ollama: '7f14ed4b5c53',
  openai: 'bc1e3e26001b',
  openrouter: '200a5d499ff6',
  perplexity: '27761b577abc',
  sakanaai: '62f738d7425b',
  togetherai: 'ccc52c938e53',
  xai: 'f7adf5986fc7',
  zai: 'b25736b3362e',
} as const satisfies LlmsDefsVersions;
