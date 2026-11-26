// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: '9aae8065848e',
  _shared: '4797bd8ea950',
  alibaba: '66866ea5e1eb',
  anthropic: 'e36285687f7b',
  azure: 'ce36778bf647',
  bedrock: 'c5881fe039c9',
  cerebras: 'd1b01add595c',
  cohere: '4584d51cd51d',
  deepseek: 'ac6b6d2f5a5b',
  googleai: 'dd3dc3c6c9eb',
  groq: 'f4dca6a1e032',
  lmstudio: '0de87b6a3efe',
  localai: 'edc61194bd10',
  metaai: '79056d143e6c',
  mistral: '2c11a5aabbc4',
  modular: '0e9646374243',
  moonshot: '3816cf1c31c7',
  nvidianim: 'cbeb9bb3c7d5',
  ollama: 'aece0c4531f9',
  openai: 'a0c05155f57e',
  openrouter: 'dbaa39880fe0',
  perplexity: '5054da053253',
  sakanaai: 'da1cd6a86530',
  togetherai: '623d06ac41d6',
  xai: '69390dbdd536',
  zai: '5473f9c406f0',
} as const satisfies LlmsDefsVersions;
