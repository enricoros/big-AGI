import type React from 'react';

import type { SvgIconProps } from '@mui/joy';

import type { BackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsServiceId } from '~/common/stores/llms/modelsservice.types';

import type { ModelDescriptionSchema } from '../server/llm.server.types';
import type { ModelVendorId } from './vendors.registry';


export interface IModelVendor<TServiceSettings extends Record<string, any> = {}, TAccess = unknown> {
  readonly id: ModelVendorId;
  readonly name: string;
  readonly displayRank: number; // [10...] Foundation Models, [30...] 3rd party Clouds, [40...] Aggregators, [50...] Local Models
  readonly location: 'local' | 'cloud';
  readonly brandColor?: string;
  readonly instanceLimit?: number;
  readonly hasFreeModels?: boolean;
  readonly hasBackendCapFn?: (backendCapabilities: BackendCapabilities) => boolean; // used to show a 'green checkmark' in the list of vendors when adding services
  readonly hasBackendCapKey?: keyof BackendCapabilities;

  // components
  readonly Icon: React.FunctionComponent<SvgIconProps>;
  readonly ServiceSetupComponent: React.ComponentType<{ serviceId: DModelsServiceId }>;

  /// abstraction interface ///

  initializeSetup?(): TServiceSettings;

  validateSetup?(setup: TServiceSettings): boolean; // client-side only, accessed via useServiceSetup

  getTransportAccess(setup?: Partial<TServiceSettings>): TAccess;

  rateLimitChatGenerate?(llm: DLLM, setup: Partial<TServiceSettings>): Promise<void>;

  rpcUpdateModelsOrThrow(
    access: TAccess,
  ): Promise<{ models: ModelDescriptionSchema[] }>;

}
