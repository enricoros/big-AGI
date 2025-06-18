import { apiAsync } from '~/common/util/trpc.client';
import type { DLLM } from '~/common/stores/llms/llms.types';

// Type for video generation start response
export interface ZhipuAIVideoTask {
  id: string; // Task ID
  model: string;
  task_status: string; // e.g., "PROCESSING", "SUCCESS", "FAILED"
  created_at?: number;
  // other fields from ZhipuAI...
}

// Type for video status check response
export interface ZhipuAIVideoStatus extends ZhipuAIVideoTask {
  videos?: { url: string; cover_image_url?: string; }[];
  error?: { code: string; message: string; };
}

/**
 * Starts video generation with ZhipuAI.
 * @param model The ZhipuAI video model (e.g., cogvideox-flash).
 * @param prompt The text prompt for video generation.
 * @param imageUrl Optional URL of an image to use as input.
 * @param params Additional parameters from the model definition or UI.
 */
export async function zhipuAIGenerateVideoStart(
  model: DLLM,
  prompt: string,
  imageUrl?: string,
  // TODO: Allow overriding params from UI if needed
): Promise<ZhipuAIVideoTask> {
  if (!model.id.startsWith('zhipuai-')) {
    throw new Error('Invalid ZhipuAI model ID for video generation.');
  }
  const apiModelId = model.id.substring('zhipuai-'.length);

  const quality = model.initialParameters?.['quality'] as string | undefined;
  const with_audio = model.initialParameters?.['with_audio'] as boolean | undefined;
  const size = model.initialParameters?.['size'] as string | undefined;
  const fps = model.initialParameters?.['fps'] as number | undefined;

  // The ZhipuAI API key is handled by the TRPC backend
  return await apiAsync.llmZhipuAI.generateVideoStart.mutate({
    model: apiModelId,
    prompt,
    image_url: imageUrl,
    quality,
    with_audio,
    size,
    fps,
  });
}

/**
 * Checks the status of a ZhipuAI video generation task.
 * @param taskId The ID of the video generation task.
 */
export async function zhipuAICheckVideoStatus(taskId: string): Promise<ZhipuAIVideoStatus> {
  // The ZhipuAI API key is handled by the TRPC backend
  return await apiAsync.llmZhipuAI.checkVideoStatus.query({
    task_id: taskId,
  });
}
