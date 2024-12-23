import { MistralIcon } from '~/common/components/icons/vendors/MistralIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { DOpenAIServiceSettings, ModelVendorOpenAI } from '../openai/openai.vendor';

import { MistralServiceSetup } from './MistralServiceSetup';


// special symbols

type DMistralServiceSettings = Pick<DOpenAIServiceSettings, 'oaiKey' | 'oaiHost'>;


/** Implementation Notes for the Mistral vendor
 */
export const ModelVendorMistral: IModelVendor<DMistralServiceSettings, OpenAIAccessSchema> = {
  id: 'mistral',
  name: 'Mistral',
  displayRank: 18,
  location: 'cloud',
  instanceLimit: 1,
  hasBackendCapKey: 'hasLlmMistral',

  // components
  Icon: MistralIcon,
  ServiceSetupComponent: MistralServiceSetup,

  // functions
  initializeSetup: () => ({
    oaiHost: 'https://api.mistral.ai/',
    oaiKey: '',
  }),
  validateSetup: (setup) => {
    return setup.oaiKey?.length >= 32;
  },
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    dialect: 'mistral',
    oaiKey: partialSetup?.oaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.oaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('mistral' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};