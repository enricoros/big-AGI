import * as React from 'react';

import DevicesIcon from '@mui/icons-material/Devices';

import { ModelVendor } from '../llm.types';
import { LocalAISourceSetup } from './LocalAISourceSetup';


export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',
  name: 'LocalAI',
  rank: 20,
  icon: <DevicesIcon />,
  location: 'local',
  instanceLimit: process.env.NODE_ENV === 'development' ? 2 : 0,

  // factories
  SourceSetupComponent: LocalAISourceSetup,
  LLMOptionsComponent: () => <>No LocalAI Options</>,
  callChat: () => Promise.reject(new Error('LocalAI is not implemented')),
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