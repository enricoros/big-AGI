import { createModelsServiceForVendor } from '~/modules/llms/vendors/vendor.helpers';
import { findAllModelVendors } from '~/modules/llms/vendors/vendors.registry';
import { getBackendCapabilities } from '~/modules/backend/store-backend-capabilities';
import { llmsUpdateModelsForServiceOrThrow } from '~/modules/llms/llm.client';

import type { DModelsService, DModelsServiceId } from '~/common/stores/llms/modelsservice.types';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


// Note: this function is designed to be called once per session
let _isConfiguring = false;
let _isConfigurationDone = false;


/**
 * Reload models for services configured in the backend.
 */
export async function reconfigureBackendModels(newLlmReconfigHash: string, setReconfigHash: (hash: string) => void) {

  // Note: double-calling is only expected to happen in react strict mode
  if (_isConfiguring || _isConfigurationDone)
    return;

  // skip if no change is detected / no config needed
  const backendCaps = getBackendCapabilities();
  const llmReconfigHash = backendCaps.hashLlmReconfig;
  if (!llmReconfigHash || llmReconfigHash === newLlmReconfigHash) {
    _isConfiguring = false;
    _isConfigurationDone = true;
    return;
  }

  // begin configuration
  _isConfiguring = true;
  setReconfigHash(llmReconfigHash);

  // find all vendors configured in the backend
  // **NOTE**: doesn't reload pure frontend ones
  const backendConfiguredVendors = findAllModelVendors()
    .filter(vendor => vendor.hasBackendCapKey && backendCaps[vendor.hasBackendCapKey]);

  // List to keep track of the service IDs in order
  const configuredServiceIds: DModelsServiceId[] = [];

  // Sequentially auto-configure each vendor
  await backendConfiguredVendors.reduce(async (promiseChain, vendor) => {
    return promiseChain
      .then(async () => {

        // find the first service for this vendor
        const { sources: modelsServices, addService } = llmsStoreState();
        let service: DModelsService;
        const firstServiceForVendor = modelsServices.find(s => s.vId === vendor.id);
        if (!firstServiceForVendor) {
          // create and append the model service, assuming the backend configuration will be successful
          service = createModelsServiceForVendor(vendor.id, modelsServices);
          addService(service);
          // re-find it now that it's added
          service = llmsStoreState().sources.find(_s => _s.id === service.id)!;
        } else
          service = firstServiceForVendor;

        // keep track of the configured service IDs
        configuredServiceIds.push(service.id);

        // auto-configure this service
        await llmsUpdateModelsForServiceOrThrow(service.id, true);
      })
      .catch(error => {
        // catches errors and logs them, but does not stop the chain
        console.error('Auto-configuration failed for vendor:', vendor.name, error);
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