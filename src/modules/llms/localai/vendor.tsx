import { DModelSource, DModelSourceId } from '../store-models';
import { LocalAISetup } from './LocalAISetup';
import { ModelVendor } from '../vendors-registry';


export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',

  // metadata
  name: 'LocalAI',
  multiple: true,
  location: 'local',
  rank: 20,

  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    id: sourceId,
    label: 'LocalAI' + (count > 0 ? ` #${count}` : ''),
    vendorId: 'localai',
    setup: {},
  }),
  createSetupComponent: (sourceId: DModelSourceId) => <LocalAISetup sourceId={sourceId} />,
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