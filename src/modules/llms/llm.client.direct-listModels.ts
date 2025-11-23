/**
 * Client-side LLM model listing - Direct in-browser execution without client <--> tRPC-server.
 * IMPORTANT - this is a dynamically imported client-side bundle, with stubs.
 */

// IMPORTANT: client-side bundle imports server-side code including stubbed code
import type { AixAPI_Access } from '../aix/server/api/aix.wiretypes';
import type { ModelDescriptionSchema } from './server/llm.server.types';
import { listModelsRunDispatch } from './server/listModels.dispatch';


// --- Client-side LLMS Model Listing Executor ---

/**
 * Client-side model listing - uses server's listModelsRunDispatch directly.
 */
export async function clientSideListModels(
  access: AixAPI_Access,
  abortSignal?: AbortSignal,
): Promise<ModelDescriptionSchema[]> {
  return await listModelsRunDispatch(access, abortSignal);
}
