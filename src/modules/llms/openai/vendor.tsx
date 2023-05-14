import * as React from 'react';

import { DModelSource, DModelSourceId, ModelVendor } from '../llm.types';
import { OpenAIIcon } from './OpenAIIcon';
import { OpenAISetup } from './OpenAISetup';


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
  createSourceSetupComponent: (sourceId: DModelSourceId) => <OpenAISetup sourceId={sourceId} />,
  createLLMSettingsComponent: () => <>No OpenAI Settings</>,
};


export interface SourceSetupOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  llmTemperature: number;
  llmResponseTokens: number;
}

export function normalizeSetup(partialSetup?: Partial<SourceSetupOpenAI>): SourceSetupOpenAI {
  return {
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...partialSetup,
  };
}