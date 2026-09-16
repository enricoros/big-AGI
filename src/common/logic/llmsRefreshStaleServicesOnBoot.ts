import { findAllModelVendors, findModelVendor } from '~/modules/llms/vendors/vendors.registry';
import { llmsDefsVersionFor } from '~/modules/llms/llm.client.defs';
import { llmsRefreshServices } from '~/modules/llms/llm.client.refresh';

import { hasServerConf } from '~/common/app.serverconf';
import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


// Note: this function is designed to be called once per session
let _bootRefreshRunning = false;
let _bootRefreshDone = false;


/**
 * Boot-time refresh of the stale services only:
 * - just created for a backend-configured vendor (new server-side key): first listing
 * - stamped with a model definitions version other than the current one for their vendor
 *   (per-vendor defs versions, AIX rolls folded in - see kb/modules/LLM-defs-refresh.md)
 * Resolves to the session stamp (the `at` of its changelog entries) after the listings and the
 * domain re-assignments, or null if nothing was refreshed - the hook for a 'models added' toast.
 */
export async function llmsRefreshStaleServicesOnBoot(remoteServices: boolean, existingServices: boolean): Promise<number | null> {

  // Note: double-calling is only expected to happen in react strict mode
  if (_bootRefreshRunning || _bootRefreshDone)
    return null;

  // begin the boot refresh
  _bootRefreshRunning = true;
  const initiallyEmpty = !llmsStoreState().llms?.length;

  // add the backend services (idempotent)
  const createdServiceIds = new Set<DModelsServiceId>();
  if (remoteServices)
    findAllModelVendors()
      .filter(vendor => vendor.hasServerConfigKey && hasServerConf(vendor.hasServerConfigKey))
      .forEach(remoteVendor => {

        // create the first service for this vendor, if missing
        const { sources: services } = llmsStoreState();
        if (!services.find(s => s.vId === remoteVendor.id))
          createdServiceIds.add(llmsStoreActions().createModelsService(remoteVendor).id);

      });

  // the stale services: newly created, or stamped with a different defs version
  // (unknown vendors, e.g. data from a newer app, are left alone)
  const staleServiceIds = llmsStoreState().sources
    .filter((service: DModelsService) => {
      if (!findModelVendor(service.vId)) return false; // exclude unknown vendors: data from a newer app, left alone
      if (createdServiceIds.has(service.id)) return true; // include just created: first listing
      return existingServices && service.defsV !== llmsDefsVersionFor(service.vId, service.setup); // include when model definitions changed since its last listing
    })
    .map(service => service.id);

  const at = Date.now();
  if (staleServiceIds.length) {

    console.log(`[llms-refresh] updating ${staleServiceIds.length}/${llmsStoreState().sources.length} services: ${staleServiceIds.join(', ')}`);

    // list through the shared refresh session (a few at a time, re-ranked after); the pre-stamp is the
    // loop protection: a failing service is not retried on every boot, but at its next version (as before)
    await llmsRefreshServices(staleServiceIds, { via: 'boot', at, preStampDefs: true }, 'boot-refresh-stale');

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

  }

  // end of the boot refresh
  _bootRefreshRunning = false;
  _bootRefreshDone = true;
  return staleServiceIds.length ? at : null;
}
