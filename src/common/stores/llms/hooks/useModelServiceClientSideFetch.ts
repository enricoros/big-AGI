import * as React from 'react';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM } from '../llms.types';
import type { DModelsService } from '../llms.service.types';
import { llmsStoreActions, useModelsStore } from '../store-llms';


const CSF_KEY = 'csf';


/**
 * Hook to manage client-side fetch setting for a model's service
 * The CSF setting is stored as 'csf' in service settings for all vendors
 */
export function useModelServiceClientSideFetch(enabled: boolean, model: DLLM | null) {

  // memo vendor
  const vendor = React.useMemo(() => {
    if (!enabled) return null;
    return findModelVendor(model?.vId);
  }, [enabled, model?.vId]);

  // external state
  const service: null | DModelsService = useModelsStore(state => !model?.sId ? null : state.sources.find(s => s.id === model.sId) ?? null);

  // actual state
  const csfAvailable: boolean | undefined = !!vendor?.csfAvailable && vendor?.csfAvailable?.(service?.setup);
  const csfActive: boolean | undefined = csfAvailable && (service?.setup as any)?.[CSF_KEY];

  const serviceId = service?.id || '';
  const csfToggle = React.useCallback((value: boolean) => {
    if (serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [CSF_KEY]: value });
  }, [serviceId]);

  const csfReset = React.useCallback(() => {
    if (serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [CSF_KEY]: false });
  }, [serviceId]);

  return { csfAvailable, csfActive, csfToggle, csfReset, vendorName: vendor?.name || vendor?.id || 'AI Service' };
}
