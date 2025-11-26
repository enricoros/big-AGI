import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';
import { ModelVendorOpenAI } from '../openai/openai.vendor';


interface DAlibabaServiceSettings {
  alibabaOaiKey: string;
  alibabaOaiHost: string;
  csf?: boolean;
}

export const ModelVendorAlibaba: IModelVendor<DAlibabaServiceSettings, OpenAIAccessSchema> = {
  id: 'alibaba',
  name: 'Alibaba Cloud',
  displayRank: 35,
  displayGroup: 'cloud',
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmAlibaba',

  /// client-side-fetch ///
  csfAvailable: _csfAlibabaAvailable,

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
    clientSideFetch: _csfAlibabaAvailable(partialSetup) && !!partialSetup?.csf,
    oaiKey: partialSetup?.alibabaOaiKey || '',
    oaiOrg: '',
    oaiHost: partialSetup?.alibabaOaiHost || '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('alibaba' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
};

function _csfAlibabaAvailable(s?: Partial<DAlibabaServiceSettings>) {
  return !!s?.alibabaOaiKey;
}
