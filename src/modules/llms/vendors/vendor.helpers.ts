import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import type { IModelVendor } from './IModelVendor';
import { findModelVendor } from './vendors.registry';



export function findServiceAccessOrThrow<TServiceSettings extends object = {}, TAccess = unknown>(serviceId: DModelsServiceId) {

  const service = findModelsServiceOrNull<TServiceSettings>(serviceId);
  if (!service)
    throw new Error(`Models Service ${serviceId} not found`);

  const vendor = findModelVendor<TServiceSettings, TAccess>(service.vId);
  if (!vendor)
    throw new Error(`Model Service ${serviceId} has no vendor`);

  return {
    service,
    serviceSettings: service.setup,
    transportAccess: vendor.getTransportAccess(service.setup),
    vendor,
  };
}

export function vendorHasBackendCap<TServiceSettings extends Record<string, any> = {}, TAccess = unknown>(vendor: IModelVendor<TServiceSettings, TAccess>) {
  const backendCaps = getBackendCapabilities();
  return vendor.hasBackendCapFn ? vendor.hasBackendCapFn(backendCaps)
    : vendor.hasBackendCapKey ? !!backendCaps[vendor.hasBackendCapKey] : false;
}
