import DevicesIcon from '@mui/icons-material/Devices';

import { LocalAISourceSetup } from './LocalAISourceSetup';
import { ModelVendor } from '../llm.types';


export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',
  name: 'LocalAI',
  rank: 20,
  location: 'local',
  instanceLimit: 0,

  // components
  Icon: DevicesIcon,
  SourceSetupComponent: LocalAISourceSetup,
  LLMOptionsComponent: () => <>No LocalAI Options</>,

  // functions
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