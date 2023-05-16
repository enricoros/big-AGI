import * as React from 'react';

import DevicesIcon from '@mui/icons-material/Devices';

import { DModelSource, DModelSourceId, ModelVendor } from '../llm.types';
import { LocalAISourceSetup } from './LocalAISourceSetup';


export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',
  name: 'LocalAI',
  rank: 20,
  icon: <DevicesIcon />,
  location: 'local',
  instanceLimit: 2,

  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    id: sourceId,
    label: 'LocalAI' + (count > 0 ? ` #${count}` : ''),
    vId: 'localai',
    setup: {},
  }),
  createSourceSetupComponent: (sourceId: DModelSourceId) => <LocalAISourceSetup sourceId={sourceId} />,
  createLLMOptionsComponent: () => <>No LocalAI Options</>,
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