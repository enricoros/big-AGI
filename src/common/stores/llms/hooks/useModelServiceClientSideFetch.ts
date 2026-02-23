import * as React from 'react';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { DLLM } from '../llms.types';
import type { DModelsService } from '../llms.service.types';
import { llmsStoreActions, useModelsStore } from '../store-llms';


const CSF_SETUP_KEY = 'csf';


/**
 * Hook to compute DC (Direct Connection) status across all services,
 * with derived booleans and enable/disable-all handlers.
 */
export function useAllServicesDCStatus(services: readonly DModelsService[]) {
  return React.useMemo(() => {
    const dcStatus = _computeAllServicesDCStatus(services);
    return {
      dcStatus,
      dcHasEligible: dcStatus.eligible > 0,
      dcAllEnabled: dcStatus.enabled === dcStatus.eligible,
      dcNoneEnabled: dcStatus.enabled === 0,
      handleEnableAllDC: () => _setAllServicesDC(services, true),
      handleDisableAllDC: () => _setAllServicesDC(services, false),
    };
  }, [services]);
}

/**
 * Compute DC (Direct Connection) status across all configured services.
 * Returns how many services are eligible for DC (vendor supports it and prerequisites met)
 * and how many currently have it enabled.
 */
function _computeAllServicesDCStatus(services: readonly DModelsService[]): { unavailable: number; eligible: number; enabled: number } {
  let unavailable = 0;
  let eligible = 0;
  let enabled = 0;
  for (const service of services) {
    const vendor = findModelVendor(service.vId);
    if (!vendor?.csfAvailable?.(service.setup)) {
      unavailable++;
    } else {
      eligible++;
      if ((service.setup as any)?.[CSF_SETUP_KEY])
        enabled++;
    }
  }
  return { unavailable, eligible, enabled };
}

function _setAllServicesDC(services: readonly DModelsService[], enable: boolean): void {
  for (const service of services) {
    const vendor = findModelVendor(service.vId);
    if (vendor?.csfAvailable?.(service.setup))
      llmsStoreActions().updateServiceSettings(service.id, { [CSF_SETUP_KEY]: enable });
  }
}


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
  const csfActive: boolean | undefined = csfAvailable && (service?.setup as any)?.[CSF_SETUP_KEY];

  const serviceId = service?.id || '';
  const csfToggle = React.useCallback((value: boolean) => {
    if (serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [CSF_SETUP_KEY]: value });
  }, [serviceId]);

  const csfReset = React.useCallback(() => {
    if (serviceId)
      llmsStoreActions().updateServiceSettings(serviceId, { [CSF_SETUP_KEY]: false });
  }, [serviceId]);

  return { csfAvailable, csfActive, csfToggle, csfReset, vendorName: vendor?.name || vendor?.id || 'AI Service' };
}
