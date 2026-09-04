// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'c6e09a15d683',
  _shared: '380b91060d6b',
  alibaba: '5de5cd98ced1',
  anthropic: '651ccca969e0',
  azure: '1697be384cd1',
  bedrock: '61b79a8c4b48',
  cerebras: 'd356fed03aba',
  cohere: 'c8088862dcbb',
  deepseek: 'b40a4684353b',
  googleai: 'ceba517362a1',
  groq: '62d51d4ddc25',
  lmstudio: '52135bdde46b',
  localai: '49d1fa2e9ab4',
  metaai: '567a26b034e4',
  mistral: '5501754f2d53',
  modular: 'f09ca75dbccf',
  moonshot: 'f8d8f60f5d6f',
  nvidianim: 'f10a0f8f62ca',
  ollama: '99502f49a368',
  openai: '2e4f80643033',
  openrouter: '0329af780cc1',
  perplexity: '6c2195f977f8',
  sakanaai: '0c2ded136e1a',
  togetherai: '7373262d8ecb',
  xai: 'e23307f40234',
  zai: '46b459edaed7',
} as const satisfies LlmsDefsVersions;
