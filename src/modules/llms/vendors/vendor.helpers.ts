import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import { getServerConf, hasServerConf } from '~/common/app.serverconf';
import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { findModelsServiceOrNull } from '~/common/stores/llms/store-llms';

import type { IModelVendor } from './IModelVendor';
import { findModelVendor } from './vendors.registry';


export function findServiceAccessOrThrow<TServiceSettings extends object = {}, TAccess = AixAPI_Access>(serviceId: DModelsServiceId) {

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

export function vendorHasServerConf<TServiceSettings extends Record<string, any> = {}, TAccess = AixAPI_Access>(vendor: IModelVendor<TServiceSettings, TAccess>) {
  return vendor.hasServerConfigFn ? vendor.hasServerConfigFn(getServerConf())
    : vendor.hasServerConfigKey ? hasServerConf(vendor.hasServerConfigKey) : false;
}
