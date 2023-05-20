import * as React from 'react';

import { DLLM, DModelSource, DModelSourceId, ModelVendor } from '../llm.types';
import { OpenAIIcon } from './OpenAIIcon';
import { OpenAILLMOptions } from './OpenAILLMOptions';
import { OpenAISourceSetup } from './OpenAISourceSetup';
import { callChat } from './openai.client';


export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  icon: <OpenAIIcon />,
  location: 'cloud',
  instanceLimit: 2,


  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    id: sourceId,
    label: 'OpenAI' + (count > 0 ? ` #${count}` : ''),
    vId: 'openai',
    setup: {},
  }),
  createSourceSetupComponent: (sourceId: DModelSourceId) => <OpenAISourceSetup sourceId={sourceId} />,
  createLLMOptionsComponent: (llm: DLLM) => <OpenAILLMOptions llm={llm} />,
  callChat: callChat,
};


export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
}

export function normalizeOAISetup(partialSetup?: Partial<SourceSetupOpenAI>): SourceSetupOpenAI {
  return {
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    ...partialSetup,
  };
}


export interface LLMOptionsOpenAI {
  llmRef: string;
  llmTemperature: number;
  llmResponseTokens: number;
}

export function normalizeOAIOptions(partialOptions?: Partial<LLMOptionsOpenAI>): LLMOptionsOpenAI {
  return {
    llmRef: 'unknown_id',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialOptions,
  };
}