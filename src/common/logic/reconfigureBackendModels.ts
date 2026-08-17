import { findAllModelVendors, findModelVendor } from '~/modules/llms/vendors/vendors.registry';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { llmsDefsVersionFor } from '~/modules/llms/llm.client.defs';
import { llmsUpdateModelsForServiceOrThrow } from '~/modules/llms/llm.client';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


// configuration
const REFRESH_CONCURRENCY = 4; // services listed in parallel at boot


// Note: this function is designed to be called once per session
let _isConfiguring = false;
let _isConfigurationDone = false;


/**
 * Selectively reload models because of:
 * - updated backend capabilities (e.g. new service added): idempotent service creation
 * - model definitions updated for a service's vendor (per-vendor defs versions, AIX rolls
 *   folded in - see kb/modules/LLM-defs-refresh.md): only the affected services re-list
 */
export async function reconfigureBackendModels(remoteServices: boolean, existingServices: boolean) {

  // Note: double-calling is only expected to happen in react strict mode
  if (_isConfiguring || _isConfigurationDone)
    return;

  // begin configuration
  _isConfiguring = true;
  const backendCaps = getBackendCapabilities();
  const initiallyEmpty = !llmsStoreState().llms?.length;

  // add the backend services (idempotent)
  const createdServiceIds = new Set<DModelsServiceId>();
  if (remoteServices)
    findAllModelVendors()
      .filter(vendor => vendor.hasServerConfigKey && backendCaps[vendor.hasServerConfigKey])
      .forEach(remoteVendor => {

        // create the first service for this vendor, if missing
        const { sources: services } = llmsStoreState();
        if (!services.find(s => s.vId === remoteVendor.id))
          createdServiceIds.add(llmsStoreActions().createModelsService(remoteVendor).id);

      });

  // reconfigure these: newly created, or stamped with a different defs version
  // (unknown vendors, e.g. data from a newer app, are left alone)
  const servicesToReconfigure = llmsStoreState().sources
    .filter((service: DModelsService) => !!findModelVendor(service.vId))
    .map(service => ({ service, defsV: llmsDefsVersionFor(service.vId, service.setup) }))
    .filter(({ service, defsV }) => createdServiceIds.has(service.id) || (existingServices && service.defsV !== defsV));

  // re-configure, a few services at a time
  if (servicesToReconfigure.length)
    console.log(`[llms-refresh] updating ${servicesToReconfigure.length}/${llmsStoreState().sources.length} services: ${servicesToReconfigure.map(({ service }) => service.id).join(', ')}`);
  const queue = [...servicesToReconfigure];
  await Promise.all(Array.from({ length: Math.min(REFRESH_CONCURRENCY, queue.length) }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const { service, defsV } = next;

      // stamp before the attempt: a failing service is not retried on every boot, but at its next version (loop protection, as before)
      llmsStoreActions().stampServiceDefs(service.id, defsV);

      // auto-configure this service - errors are logged and do not stop the others
      try {
        await llmsUpdateModelsForServiceOrThrow(service.id, true);
      } catch (error) {
        console.warn('Auto-configuration failed for service:', service.label, error);
      }
    }
  }));

  // nothing to reconfigure: leave the models and assignments as they are
  if (!servicesToReconfigure.length) {
    _isConfiguring = false;
    _isConfigurationDone = true;
    return false;
  }

  // Re-rank the LLMs to the services order (partial refreshes prepend, this restores stability)
  llmsStoreActions().rerankLLMsByServices(llmsStoreState().sources.map(s => s.id));

  // Auto-assignment conditions
  if (initiallyEmpty) {
    // in case we refreshed all vendors, auto-assign the primary chat model, so it doesn't get locked to the first vendor
    llmsStoreActions().assignDomainModelAuto('primaryChat');
  } else {
    // in case the chat model becomes unavailable/hidden, we'll auto-reassign it
    llmsStoreActions().assignDomainModelAutoIfStale('primaryChat', true);
    llmsStoreActions().assignDomainModelAutoIfStale('codeApply', false);
    llmsStoreActions().assignDomainModelAutoIfStale('fastUtil', false);
  }

  // end configuration
  _isConfiguring = false;
  _isConfigurationDone = true;
  return true;
}