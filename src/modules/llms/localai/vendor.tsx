import { SourceConfig } from './SourceConfig';
import { ModelVendor } from '../vendors-registry';
import { DModelSource, DModelSourceId } from '~/modules/llms/store-models';

export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',

  // metadata
  name: 'LocalAI',
  multiple: true,
  location: 'local',
  rank: 20,

  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    sourceId,
    label: 'LocalAI' + (count > 0 ? ` #${count}` : ''),
    vendorId: 'localai',
    _config: {},
  }),
  configureSourceComponent: (sourceId: DModelSourceId) => <SourceConfig sourceId={sourceId} />,
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