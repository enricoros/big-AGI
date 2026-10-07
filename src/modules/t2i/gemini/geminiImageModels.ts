import * as React from 'react';

import type { DModelsServiceId } from '~/common/stores/llms/llms.service.types';
import { DLLM, isLLMVisible, LLM_IF_Outputs_Image } from '~/common/stores/llms/llms.types';
import { DModelParameterRegistry, DModelParameterSpec } from '~/common/stores/llms/llms.parameters';
import { llmsStoreState, useModelsStore } from '~/common/stores/llms/store-llms';

import type { DProfileGeminiImages, GeminiImageAspectRatio, GeminiImageSize } from '../t2i.types';


// fallback when the linked service has no image-output models loaded
const GEMINI_IMAGE_FALLBACK: GeminiImageModel = {
  modelRef: 'models/gemini-nano-banana-2.1',
  label: 'Nano Banana 2.1',
  aspectRatios: DModelParameterRegistry.llmVndGeminiAspectRatio.values,
  imageSizes: ['1K', '2K', '4K'],
};

/** An image-output model of a Gemini service, with the aspect ratios and sizes its definition allows. */
export interface GeminiImageModel {
  modelRef: string; // vendor model id, e.g. 'models/gemini-nano-banana-2.1'
  label: string;
  aspectRatios: readonly GeminiImageAspectRatio[];
  imageSizes: readonly GeminiImageSize[]; // empty: fixed size, the model takes no image size
}


/**
 * The service's image-output models (Nano Banana family), in the service's model order.
 * Hidden models are kept only when selected, so a superseded selection still shows.
 */
function _geminiImageModels(llms: readonly DLLM[], serviceId: DModelsServiceId, selectedRef: string | null): GeminiImageModel[] {
  const models: GeminiImageModel[] = [];
  for (const llm of llms) {
    if (llm.sId !== serviceId || !llm.interfaces.includes(LLM_IF_Outputs_Image)) continue;
    const modelRef = llm.initialParameters?.llmRef;
    if (!modelRef || models.some(m => m.modelRef === modelRef)) continue; // skip variants
    if (!isLLMVisible(llm) && modelRef !== selectedRef) continue;

    const arSpec = llm.parameterSpecs.find((s): s is DModelParameterSpec<'llmVndGeminiAspectRatio'> => s.paramId === 'llmVndGeminiAspectRatio');
    const sizeSpec = llm.parameterSpecs.find((s): s is DModelParameterSpec<'llmVndGeminiImageSize'> => s.paramId === 'llmVndGeminiImageSize');
    models.push({
      modelRef,
      label: llm.label,
      aspectRatios: !arSpec ? [] : arSpec.enumValues ?? DModelParameterRegistry.llmVndGeminiAspectRatio.values,
      imageSizes: !sizeSpec ? [] : sizeSpec.enumValues ?? DModelParameterRegistry.llmVndGeminiImageSize.values,
    });
  }
  return models;
}

function _resolve(models: GeminiImageModel[], selectedRef: string | null): GeminiImageModel {
  return (selectedRef ? models.find(m => m.modelRef === selectedRef) : models[0]) ?? models[0] ?? GEMINI_IMAGE_FALLBACK;
}


/** Generation-time resolution: the model to call and the profile options it accepts (unsupported ones dropped). */
export function geminiImageResolveForGeneration(serviceId: DModelsServiceId, profile: DProfileGeminiImages) {
  const model = _resolve(_geminiImageModels(llmsStoreState().llms, serviceId, profile.imageModelRef), profile.imageModelRef);
  return {
    model,
    aspectRatio: profile.aspectRatio && model.aspectRatios.includes(profile.aspectRatio) ? profile.aspectRatio : undefined,
    imageSize: profile.imageSize && model.imageSizes.includes(profile.imageSize) ? profile.imageSize : undefined,
  };
}

/** Painter name for a profile, from any loaded Gemini model with that ref. */
export function geminiImageModelLabel(imageModelRef: string | null): string {
  if (!imageModelRef) return 'Nano Banana';
  const llm = llmsStoreState().llms.find(m => m.vId === 'googleai' && m.initialParameters?.llmRef === imageModelRef);
  return llm?.label ?? imageModelRef.replace(/^models\//, '');
}

/** UI: the service's image models and the resolved (selected or auto) one. */
export function useGeminiImageModels(serviceId: DModelsServiceId | null, selectedRef: string | null) {
  const llms = useModelsStore(state => state.llms);
  return React.useMemo(() => {
    const models = serviceId ? _geminiImageModels(llms, serviceId, selectedRef) : [];
    return { models, resolved: _resolve(models, selectedRef) };
  }, [llms, selectedRef, serviceId]);
}
