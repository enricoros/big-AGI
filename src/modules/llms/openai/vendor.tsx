import { ModelVendor } from '../vendors-registry';
import { SourceConfig } from './SourceConfig';

export const ModelVendorOpenAI: ModelVendor = {
  id: 'openai',

  // metadata
  name: 'OpenAI',
  multiple: false,
  location: 'cloud',
  rank: 10,

  // factories
  configureSourceComponent: (sourceId) => <SourceConfig sourceId={sourceId} />,
};

export interface SourceConfigOpenAI {
  oaiKey: string;
  oaiOrg: string;
  oaiHost: string;  // use OpenAI-compatible non-default hosts (full origin path)
  heliKey: string;  // helicone key (works in conjunction with oaiHost)
  llmTemperature: number;
  llmResponseTokens: number;
}

export function normConfigOpenAI(config?: Partial<SourceConfigOpenAI>): SourceConfigOpenAI {
  return {
    oaiKey: '',
    oaiOrg: '',
    oaiHost: '',
    heliKey: '',
    llmTemperature: 0.5,
    llmResponseTokens: 1024,
    ...config,
  };
}