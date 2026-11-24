// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '1e7ab0da9cc8',
  _shared: '824c836866a1',
  alibaba: '3dc0cf89d37b',
  anthropic: '0916ec1cd9e6',
  azure: '0762579bafab',
  bedrock: '0accc20da5f6',
  cerebras: '14c06b3cc6ba',
  cohere: '6f7096eba7f1',
  deepseek: 'fb7ce8e53ff3',
  googleai: 'fe0d39a896a0',
  groq: 'c5dc92170ca3',
  lmstudio: '7f2fe09ace8f',
  localai: 'cd37d699833d',
  metaai: 'f9bb95490134',
  mistral: '7bc9b0d3f942',
  modular: '1322da3d5017',
  moonshot: '7278b11ef710',
  nvidianim: '4825222a6792',
  ollama: '2b3290caf4ad',
  openai: '39a1cd4ac908',
  openrouter: '4bf8dfbb5420',
  perplexity: '4490e9b669d2',
  sakanaai: '63ca43c867e6',
  togetherai: '342fc23fcb45',
  xai: '63a53d2aa4ac',
  zai: '4ec0a4bd3332',
} as const satisfies LlmsDefsVersions;
