import { findAllModelVendors } from '~/modules/llms/vendors/vendors.registry';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { llmsUpdateModelsForServiceOrThrow } from '~/modules/llms/llm.client';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


// Note: this function is designed to be called once per session
let _isConfiguring = false;
let _isConfigurationDone = false;


/**
 * Reload models because of:
 * - updated backend capabilities (e.g. new service added)
 * - AIX/LLMs updated, in which case we'd have to re-scan services
 */
export async function reconfigureBackendModels(lastLlmReconfigHash: string, setLastReconfigHash: (hash: string) => void, remoteServices: boolean, existingServices: boolean) {

  // Note: double-calling is only expected to happen in react strict mode
  if (_isConfiguring || _isConfigurationDone)
    return;

  // skip if there haven't been any changes in the backend configuration
  // Note: the hash captures both AIX/LLMs changes and new backend-configured services
  const backendCaps = getBackendCapabilities();
  const backendReconfigHash = backendCaps.hashLlmReconfig;
  if (!backendReconfigHash || lastLlmReconfigHash === backendReconfigHash) {
    _isConfiguring = false;
    _isConfigurationDone = true;
    return;
  }

  // begin configuration
  _isConfiguring = true;
  // FIXME: future: move this to the end of the function, but also with strong retry count and error catching, so one's app wouldn't loop upon each boot
  setLastReconfigHash(backendReconfigHash);

  // reconfigure these
  const servicesToReconfigure: DModelsService[] = [];

  // add the backend services
  if (remoteServices)
    findAllModelVendors()
      .filter(vendor => vendor.hasBackendCapKey && backendCaps[vendor.hasBackendCapKey])
      .forEach(remoteVendor => {

        // find the first service for this vendor
        const { sources: services, createModelsService } = llmsStoreState();
        const remoteService = services.find(s => s.vId === remoteVendor.id) || createModelsService(remoteVendor);
        servicesToReconfigure.push(remoteService);

      });

  // add any other local services
  if (existingServices)
    llmsStoreState().sources
      .filter(s => !servicesToReconfigure.includes(s))
      .forEach(s => servicesToReconfigure.push(s));


  // track in order the services that were configured
  const configuredServiceIds: DModelsServiceId[] = [];

  // sequentially re-configure
  await servicesToReconfigure.reduce(async (promiseChain, service) => {
    return promiseChain
      .then(async () => {
        // keep track of the configured service IDs
        configuredServiceIds.push(service.id);

        // auto-configure this service
        await llmsUpdateModelsForServiceOrThrow(service.id, true);
      })
      .catch(error => {
        // catches errors and logs them, but does not stop the chain
        console.error('Auto-configuration failed for service:', service.label, error);
      })
      .then(() => {
        // short delay between vendors
        return new Promise(resolve => setTimeout(resolve, 50));
      });
  }, Promise.resolve());

  // Re-rank the LLMs based on the order of configured services
  llmsStoreActions().rerankLLMsByServices(configuredServiceIds);

  // if the current global Chat LLM is now hidden, auto-pick one that's not
  const { llms: updatedLLMs, chatLLMId: newChatLLMId } = llmsStoreState();
  if (newChatLLMId) {
    const currentChatLLM = updatedLLMs.find(llm => llm.id === newChatLLMId);
    if (!currentChatLLM || currentChatLLM.hidden)
      llmsStoreActions().setChatLLMId(null);
  }

  // end configuration
  _isConfiguring = false;
  _isConfigurationDone = true;
  return true;
}