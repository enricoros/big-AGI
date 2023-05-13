import { ModelVendor } from '../vendors-registry';
import { OpenAISource } from './OpenAISource';

export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',

  // metadata
  name: 'OpenAI',
  multiple: false,
  location: 'cloud',
  rank: 10,

  // factories
  configureSourceComponent: (sourceId) => <OpenAISource sourceId={sourceId} />,
};