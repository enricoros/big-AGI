import { ModelVendor } from '../vendors-registry';
import { OpenAISetup } from './OpenAISetup';
import { DModelSource, DModelSourceId } from '~/modules/llms/store-models';

export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',

  // metadata
  name: 'OpenAI',
  multiple: false,
  location: 'cloud',
  rank: 10,

  // factories
  createSource: (sourceId: DModelSourceId, count: number): DModelSource => ({
    sourceId,
    label: 'OpenAI' + (count > 0 ? ` #${count}` : ''),
    vendorId: 'openai',
    setup: {},
  }),
  createSetupComponent: (sourceId: DModelSourceId) => <OpenAISetup sourceId={sourceId} />,
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