// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '67b149d384ac',
  _shared: 'd8f62259fc24',
  alibaba: '397d762bbdd1',
  anthropic: 'ff902024d6ca',
  azure: '77cffaafe912',
  bedrock: '4add06944ca8',
  cerebras: '0a4e58ed7544',
  cohere: 'aae6763fef9d',
  deepseek: '266b387ae20f',
  googleai: '21ac44c965ec',
  groq: '50a100b5d817',
  lmstudio: '00d1f91a732d',
  localai: '6d0c23dab5f8',
  metaai: '8aea9fc97f38',
  mistral: 'c9c1875ce62d',
  modular: '0810d069a895',
  moonshot: '5f797c962a7d',
  nvidianim: 'ecd7f1026acf',
  ollama: '5cdc3b373b8f',
  openai: 'd06b618809d6',
  openrouter: '44c6afd1b7be',
  perplexity: '773c51fee23b',
  sakanaai: 'a87f48ef6aaf',
  togetherai: '76b15f66e2e0',
  xai: '5675de340d60',
  zai: 'd02b9c611709',
} as const satisfies LlmsDefsVersions;
