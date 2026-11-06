// GENERATED FILE - DO NOT EDIT
// Per-vendor model-defs versions, derived from the runtime semantics of the files claimed by
// ../llms.defs.manifest.ts - regenerate with: node tools/develop/gen-llms-defs/generate-llms-defs.mjs
// (next dev / next build regenerate it automatically; commit the result)

import type { ModelVendorId } from '../../vendors/vendors.registry';

export type LlmsDefsVersions = Readonly<Record<ModelVendorId | '_shared' | '_openaiCompat', string>>;

export const LLMS_DEFS_VERSIONS = {
  _openaiCompat: 'e559838151d9',
  _shared: '34b527803117',
  alibaba: '16a919311620',
  anthropic: '75dee0a1c7e2',
  azure: '331b4545d39f',
  bedrock: 'c1264fea0b03',
  cerebras: '526971a04f5b',
  cohere: 'b767a996c1f3',
  deepseek: '7e5272cb2435',
  googleai: 'ebb5871c92f6',
  groq: '1f30f01155f6',
  lmstudio: 'ffa473b1e073',
  localai: '385c21257f68',
  metaai: '64209bd38177',
  mistral: '3464e400e848',
  modular: 'e72fff549179',
  moonshot: '872bb5db670e',
  nvidianim: '471fa92a24ea',
  ollama: '46971cc7459e',
  openai: '2b7e15b05f7c',
  openrouter: 'f29c719a8b05',
  perplexity: '638b6ecf9161',
  sakanaai: 'cdb6c4d6088a',
  togetherai: '5e40121194eb',
  xai: 'f3015b62bea9',
  zai: '1311d4fbb637',
} as const satisfies LlmsDefsVersions;
