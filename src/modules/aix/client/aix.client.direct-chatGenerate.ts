/**
 * Client-side AIX execution - Direct in-browser execution without client <--> tRPC-server.
 * IMPORTANT - this is a dynamically imported client-side bundle, with stubs.
 */

import { capitalizeFirstLetter } from '~/common/util/textUtils';

// IMPORTANT: client-side bundle imports server-side code including stubbed code
import type { AixAPI_Access, AixAPI_ConnectionOptions_ChatGenerate, AixAPI_Context_ChatGenerate, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '../server/api/aix.wiretypes';
import type { AixDebugObject } from '../server/dispatch/chatGenerate/chatGenerate.debug';
import { AIX_INSPECTOR_ALLOWED_CONTEXTS, AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../server/api/aix.security';
import { createChatGenerateDispatch } from '../server/dispatch/chatGenerate/chatGenerate.dispatch';
import { executeChatGenerateWithRetry } from '../server/dispatch/chatGenerate/chatGenerate.retrier';


// --- Client-side AIX ChatGenerate Executor ---

/**
 * Client-side chat generation - uses server's executeChatGenerateWithRetry directly.
 * Matches server-side pattern exactly.
 */
export async function* clientSideChatGenerate(
  access: AixAPI_Access,
  model: AixAPI_Model,
  chatGenerate: AixAPIChatGenerate_Request,
  context: AixAPI_Context_ChatGenerate,
  streaming: boolean,
  connectionOptions: AixAPI_ConnectionOptions_ChatGenerate,
  abortSignal: AbortSignal,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {
  // keep in sync with the `aixRouter.chatGenerateContent` server-side procedure
  const _d: AixDebugObject = _createClientDebugConfig(access, connectionOptions, context.name);
  const chatGenerateDispatchCreator = () => createChatGenerateDispatch(access, model, chatGenerate, streaming, !!connectionOptions?.enableResumability);

  yield* executeChatGenerateWithRetry(chatGenerateDispatchCreator, streaming, abortSignal, _d);
}

// CSF debug config - lighter than server-side
function _createClientDebugConfig(access: AixAPI_Access, options: undefined | { debugDispatchRequest?: boolean, debugProfilePerformance?: boolean, debugRequestBodyOverride?: Record<string, unknown> }, chatGenerateContextName: string): AixDebugObject {
  const echoRequest = !!options?.debugDispatchRequest && (AIX_SECURITY_ONLY_IN_DEV_BUILDS || AIX_INSPECTOR_ALLOWED_CONTEXTS.includes(chatGenerateContextName));
  return {
    prettyDialect: capitalizeFirstLetter(access.dialect), // string
    echoRequest: echoRequest, // boolean
    requestBodyOverride: echoRequest ? options?.debugRequestBodyOverride : undefined,
    consoleLogErrors: false, // NO client-side error-echo log to console (handled by UI)
    profiler: undefined, // NO client-side profiler
    wire: undefined, // NO client-side wire
  };
}
