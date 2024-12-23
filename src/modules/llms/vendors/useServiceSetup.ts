import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { DLLM } from '~/common/stores/llms/llms.types';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { useShallowStabilizer } from '~/common/util/hooks/useShallowObject';
import { useModelsStore } from '~/common/stores/llms/store-llms';

import type { IModelVendor } from './IModelVendor';
import { vendorHasBackendCap } from './vendor.helpers';


const stableNoLlms: DLLM[] = [];

/**
 * Service-specific read/write - great time saver
 */
export function useServiceSetup<TServiceSettings extends object, TAccess>(serviceId: DModelsServiceId, vendor: IModelVendor<TServiceSettings, TAccess>): {
  service: DModelsService<TServiceSettings> | null;
  serviceAccess: TAccess;

  serviceHasBackendCap: boolean;
  serviceHasLLMs: boolean;
  serviceHasVisibleLLMs: boolean;
  serviceSetupValid: boolean;

  partialSettings: Partial<TServiceSettings> | null;
  updateSettings: (partialSettings: Partial<TServiceSettings>) => void;
} {

  // stabilize the transport access
  const stabilizeTransportAccess = useShallowStabilizer<TAccess>();

  // invalidates only when the setup changes
  const { updateServiceSettings, ...rest } = useModelsStore(useShallow(({ llms, sources, updateServiceSettings }) => {

    // find the service | null
    const service: DModelsService<TServiceSettings> | null = sources.find(s => s.id === serviceId) ?? null;

    // (safe) service-derived properties
    const serviceSetupValid = (service?.setup && vendor?.validateSetup) ? vendor.validateSetup(service.setup as TServiceSettings) : false;
    const serviceLLms = service ? llms.filter(llm => llm.sId === serviceId) : stableNoLlms;
    const serviceAccess = stabilizeTransportAccess(vendor.getTransportAccess(service?.setup));

    return {
      service,
      serviceAccess,

      serviceHasBackendCap: vendorHasBackendCap(vendor),
      serviceHasLLMs: !!serviceLLms.length,
      serviceHasVisibleLLMs: !!serviceLLms.find(llm => !llm.hidden),
      serviceSetupValid: serviceSetupValid,

      partialSettings: service?.setup ?? null, // NOTE: do not use - prefer ACCESS; only used in 1 edge case now
      updateServiceSettings,
    };
  }));

  // convenience functions
  const updateSettings = React.useCallback((partialSetup: Partial<TServiceSettings>) => {
    updateServiceSettings<TServiceSettings>(serviceId, partialSetup);
  }, [serviceId, updateServiceSettings]);

  return {
    ...rest,
    updateSettings,
  };
}