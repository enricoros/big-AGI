import * as React from 'react';

import { DLLM, DModelSource, DModelSourceId, ModelVendor } from '../llm.types';
import { Icon } from './Icon';
import { LLMSettings } from './LLMSettings';
import { SourceSetup } from './SourceSetup';


export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',
  name: 'OpenAI',
  rank: 10,
  icon: <Icon />,
  location: 'cloud',
  instanceLimit: 2,


  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    id: sourceId,
    label: 'OpenAI' + (count > 0 ? ` #${count}` : ''),
    vId: 'openai',
    setup: {},
  }),
  createSourceSetupComponent: (sourceId: DModelSourceId) => <SourceSetup sourceId={sourceId} />,
  createLLMSettingsComponent: (llm: DLLM) => <LLMSettings llm={llm} />,
};


export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
}

export function normalizeSetup(partialSetup?: Partial<SourceSetupOpenAI>): SourceSetupOpenAI {
  return {
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    ...partialSetup,
  };
}


export interface LLMSettingsOpenAI {
  llmTemperature: number;
  llmResponseTokens: number;
}

export function normalizeLLMSettings(partialSettings?: Partial<LLMSettingsOpenAI>): LLMSettingsOpenAI {
  return {
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialSettings,
  };
}