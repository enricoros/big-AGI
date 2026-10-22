import type { DLLMId } from '~/common/stores/llms/llms.types';
import { optimaOpenModels } from '~/common/layout/optima/useOptima';
import { llmsStoreActions, llmsStoreState } from '~/common/stores/llms/store-llms';


export function openModelsForLLM(llmId: DLLMId | null | undefined) {
  const { llms, sources } = llmsStoreState();
  const serviceId = llmId ? llms.find(llm => llm.id === llmId)?.sId : undefined;
  if (serviceId && sources.some(service => service.id === serviceId))
    llmsStoreActions().setConfServiceId(serviceId);
  optimaOpenModels();
}
