// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '7fb5b40ff6b7',
  _shared: '9418c65ba22d',
  alibaba: '8a4f16fec58c',
  anthropic: '3457a8e0cb42',
  azure: '858a21566dca',
  bedrock: '23fc1ff06863',
  cerebras: '6397944b89db',
  cohere: 'd0c0cea21c51',
  deepseek: '4879f9ce4449',
  googleai: '62ebe89c5def',
  groq: '164ebcb47b72',
  lmstudio: '85eb57eb8e42',
  localai: '2a8b423c867f',
  mistral: '694524773ba1',
  modular: 'e35d16f74e4c',
  moonshot: '862b5a9f71bd',
  nvidianim: '2e99be411802',
  ollama: 'c256a41a5438',
  openai: 'bc1e3e26001b',
  openrouter: '200a5d499ff6',
  perplexity: '27761b577abc',
  sakanaai: '62f738d7425b',
  togetherai: 'dda44c74be94',
  xai: 'f7adf5986fc7',
  zai: 'b25736b3362e',
} as const satisfies LlmsDefsVersions;
