import { LocalAISource } from './LocalAISource';
import { ModelVendor } from '../vendors-registry';

export const ModelVendorLocalAI: ModelVendor = {
  id: 'localai',

  // metadata
  name: 'LocalAI',
  multiple: true,
  location: 'local',
  rank: 20,

  // factories
  configureSourceComponent: (sourceId) => <LocalAISource sourceId={sourceId} />,
};