/**
 * Client-side AIX execution - Direct in-browser execution without client <--> tRPC-server.
 * IMPORTANT - this is a dynamically imported client-side bundle, with stubs.
 */

import { capitalizeFirstLetter } from '~/common/util/textUtils';

// IMPORTANT: client-side bundle imports server-side code including stubbed code
import type { AixAPI_Access, AixAPI_Model, AixAPIChatGenerate_Request, AixWire_Particles } from '../server/api/aix.wiretypes';
import type { AixDebugObject } from '../server/dispatch/chatGenerate/chatGenerate.debug';
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
  streaming: boolean,
  abortSignal: AbortSignal,
  enableResumability: boolean = false,
): AsyncGenerator<AixWire_Particles.ChatGenerateOp, void> {
  // keep in sync with the `aixRouter.chatGenerateContent` server-side procedure
  const _d: AixDebugObject = _createClientDebugConfig(access);
  const chatGenerateDispatchCreator = () => createChatGenerateDispatch(access, model, chatGenerate, streaming, enableResumability);

  yield* executeChatGenerateWithRetry(chatGenerateDispatchCreator, streaming, abortSignal, _d);
}

// CSF debug config - lighter than server-side
function _createClientDebugConfig(access: AixAPI_Access): AixDebugObject {
  return {
    prettyDialect: capitalizeFirstLetter(access.dialect),
    echoRequest: false, // disable request echo on client, as one can inspect fetch directly
    consoleLogErrors: false, // don't log to console on client (handled by UI)
    profiler: undefined,
    wire: undefined,
  };
}
