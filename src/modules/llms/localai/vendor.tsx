import { SourceConfig } from './SourceConfig';
import { ModelVendor } from '../vendors-registry';

export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',

  // metadata
  name: 'LocalAI',
  multiple: true,
  location: 'local',
  rank: 20,

  // factories
  configureSourceComponent: (sourceId) => <SourceConfig sourceId={sourceId} />,
};


export interface SourceConfigLocalAI {
  hostUrl: string;
}

export function normConfigLocalAI(config?: Partial<SourceConfigLocalAI>): SourceConfigLocalAI {
  return {
    hostUrl: '',
    ...config,
  };
}