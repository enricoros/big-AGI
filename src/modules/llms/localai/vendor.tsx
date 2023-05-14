import * as React from 'react';

import { DModelSource, DModelSourceId, ModelVendor } from '../llm.types';
import { LocalAISetup } from './LocalAISetup';


export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',
  name: 'LocalAI',
  rank: 20,
  icon: null,
  location: 'local',
  instanceLimit: 2,

  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    id: sourceId,
    label: 'LocalAI' + (count > 0 ? ` #${count}` : ''),
    vId: 'localai',
    setup: {},
  }),
  createSourceSetupComponent: (sourceId: DModelSourceId) => <LocalAISetup sourceId={sourceId} />,
  createLLMSettingsComponent: () => <>No LocalAI Settings</>,
};


export interface SourceSetupLocalAI {
  hostUrl: string;
}

export function normalizeSetup(partialSetup?: Partial<SourceSetupLocalAI>): SourceSetupLocalAI {
  return {
    hostUrl: '',
    ...partialSetup,
  };
}