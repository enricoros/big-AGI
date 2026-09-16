import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import type { ServerConf, ServerConfFlag } from '~/common/app.serverconf';
import type { DLLM } from '~/common/stores/llms/llms.types';

import type { ModelDescriptionSchema } from '../server/llm.server.types';
import type { ModelVendorId } from './vendors.registry';


type ServiceSettingsBase = {
  csf?: boolean,
  [key: string]: any,
};

export interface IModelVendor<TServiceSettings extends ServiceSettingsBase = {}, TAccess = AixAPI_Access> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly displayRank: number; // [10...] Foundation Models, [30...] 3rd party Clouds, [40...] Aggregators, [50...] Local Models
  readonly displayGroup: 'popular' | 'cloud' | 'local';
  readonly location: 'local' | 'cloud';
  readonly brandColor?: string;
  readonly instanceLimit?: number;
  readonly hasFreeModels?: boolean;
  readonly hasServerConfigFn?: (serverConf: ServerConf) => boolean; // used to show a 'green checkmark' in the list of vendors when adding services
  readonly hasServerConfigKey?: ServerConfFlag;

  /// client-side-fetch ///
  readonly csfAvailable?: (setup?: Partial<TServiceSettings>) => boolean; // undefined: not supported, false: conditions not met

  /// abstraction interface ///

  initializeSetup?(): TServiceSettings;

  validateSetup?(setup: TServiceSettings): boolean; // client-side only, accessed via useServiceSetup

  getTransportAccess(setup?: Partial<TServiceSettings>): TAccess;

  rateLimitChatGenerate?(llm: DLLM, setup: Partial<TServiceSettings>): Promise<void>;

  rpcUpdateModelsOrThrow(
    this: void, // detach-safe attestation: vendors cross-reference each other's implementations (e.g. `ModelVendorOpenAI.rpcUpdateModelsOrThrow`)
    access: TAccess,
  ): Promise<{ models: ModelDescriptionSchema[] }>;

}
