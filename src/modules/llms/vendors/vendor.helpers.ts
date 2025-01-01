import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import type { IModelVendor } from './IModelVendor';
import { findModelVendor, ModelVendorId } from './vendors.registry';


// configuration
const MODEL_VENDOR_DEFAULT: ModelVendorId = 'openai';


export function createModelsServiceForDefaultVendor(otherServices: DModelsService[]): DModelsService {
  return createModelsServiceForVendor(MODEL_VENDOR_DEFAULT, otherServices);
}

export function createModelsServiceForVendor(vendorId: ModelVendorId, otherServices: DModelsService[]): DModelsService {
  // get vendor
  const vendor = findModelVendor(vendorId);
  if (!vendor) throw new Error(`createModelsServiceForVendor: Vendor not found for id ${vendorId}`);

  // make a unique service id
  let serviceId: DModelsServiceId = vendorId;
  let serviceIdx = 0;
  while (otherServices.find(s => s.id === serviceId)) {
    serviceIdx++;
    serviceId = `${vendorId}-${serviceIdx}`;
  }

  // create the service
  return {
    id: serviceId,
    label: vendor.name, // NOTE: will be (re/) numbered upon adding to the store
    vId: vendorId,
    setup: vendor.initializeSetup?.() || {},
  };
}

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
