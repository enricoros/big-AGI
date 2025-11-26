import * as React from 'react';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM } from '../llms.types';
import type { DModelsService } from '../llms.service.types';
import { llmsStoreActions, useModelsStore } from '../store-llms';


/**
 * Hook to manage client-side fetch setting for a model's service
 */
export function useModelServiceClientSideFetch(enabled: boolean, model: DLLM | null) {

  // memo vendor
  const { vendor, csfKey } = React.useMemo(() => {
    if (!enabled) return { vendor: null, csfKey: '' };
    const vendor = findModelVendor(model?.vId);
    const csfKey = vendor?.csfKey || '';
    return { vendor, csfKey };
  }, [enabled, model?.vId]);

  // external state
  const service: null | DModelsService = useModelsStore(state => !model?.sId ? null : state.sources.find(s => s.id === model.sId) ?? null);

  // actual state
  const csfAvailable: boolean | undefined = !!csfKey && vendor?.csfAvailable?.(service?.setup);
  const csfActive: boolean | undefined = csfAvailable && (service?.setup as any)?.[csfKey];

  const serviceId = service?.id || '';
  const csfToggle = React.useCallback((value: boolean) => {
    if (csfKey && serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [csfKey]: value });
  }, [csfKey, serviceId]);

  const csfReset = React.useCallback(() => {
    if (csfKey && serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [csfKey]: false });
  }, [csfKey, serviceId]);

  return { csfAvailable, csfActive, csfToggle, csfReset, vendorName: vendor?.name || vendor?.id || 'AI Service' };
}
