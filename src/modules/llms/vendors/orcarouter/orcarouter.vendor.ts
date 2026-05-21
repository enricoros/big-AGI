import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.access';

import { ModelVendorOpenAI } from '../openai/openai.vendor';

/**
 * OrcaRouter provider - https://www.orcarouter.ai/
 *
 * OrcaRouter is an OpenAI-compatible API gateway that routes requests across multiple LLM providers
 * (OpenAI, Anthropic, DeepSeek, etc.) with a variety of intelligent routing strategies.
 *
 * Documentation: https://docs.orcarouter.ai/introduction
 */

export const isValidOrcaRouterKey = (apiKey?: string) => !!apiKey && apiKey.startsWith('sk-orca-') && apiKey.length > 40;

interface DOrcaRouterServiceSettings {
  orcaKey: string;
  orcaHost: string;
  csf?: boolean;
}

export const ModelVendorOrcaRouter: IModelVendor<DOrcaRouterServiceSettings, OpenAIAccessSchema> = {
  id: 'orcarouter',
  name: 'OrcaRouter',
  displayRank: 41,
  displayGroup: 'popular',
  location: 'cloud',
  instanceLimit: 1,

  /// client-side-fetch ///
  csfAvailable: _csfOrcaRouterAvailable,

  initializeSetup: (): DOrcaRouterServiceSettings => ({
    orcaHost: 'https://api.orcarouter.ai',
    orcaKey: '',
  }),
  getTransportAccess: (partialSetup): OpenAIAccessSchema => ({
    // OrcaRouter is OpenAI-compatible on /v1/chat/completions and /v1/models.
    // Host should not include /v1 because API paths are appended by the transport layer.
    dialect: 'orcarouter',
    clientSideFetch: false,
    oaiKey: partialSetup?.orcaKey || '',
    oaiOrg: '',
    oaiHost: _normalizeOrcaHost(partialSetup?.orcaHost || ''),
    heliKey: '',
  }),

  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,
};

function _csfOrcaRouterAvailable(_s?: Partial<DOrcaRouterServiceSettings>) {
  return false;
}

function _normalizeOrcaHost(host: string): string {
  return host.replace(/\/v1\/?$/, '');
}
