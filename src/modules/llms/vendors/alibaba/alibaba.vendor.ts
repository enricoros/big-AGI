import { AlibabaCloudIcon } from '~/common/components/icons/vendors/AlibabaCloudIcon';

import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';
import { ModelVendorOpenAI } from '../openai/openai.vendor';

import { AlibabaServiceSetup } from './AlibabaServiceSetup';


interface DAlibabaServiceSettings {
  alibabaOaiKey: string;
  alibabaOaiHost: string;
}

export const ModelVendorAlibaba: IModelVendor<DAlibabaServiceSettings, OpenAIAccessSchema> = {
  id: 'alibaba',
  name: 'Alibaba Cloud',
  displayRank: 35,
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmAlibaba',

  // components
  Icon: AlibabaCloudIcon,
  ServiceSetupComponent: AlibabaServiceSetup,

  // functions
  initializeSetup: () => ({
    alibabaOaiKey: '',
    alibabaOaiHost: '',
  }),
  validateSetup: (setup) => {
    return setup.alibabaOaiKey?.length >= 32;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'alibaba',
    oaiKey: partialSetup?.alibabaOaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.alibabaOaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('alibaba' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
};
