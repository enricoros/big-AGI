import { createServerDebugWireEvents, serverCapitalizeFirstLetter } from '~/server/wire';

import type { AixAPI_Access, AixAPI_Context_ChatGenerate } from '../../api/aix.wiretypes';
import { AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../../api/aix.security';
import { PerformanceProfiler } from '../PerformanceProfiler';


/**
 * Production-allowed contexts for AIX inspector.
 * These are the only contexts that can be captured in production builds for security.
 */
const AIX_INSPECTOR_ALLOWED_CONTEXTS: (AixAPI_Context_ChatGenerate['name'] | string)[] = [
  'beam-followup',
  'beam-gather',
  'beam-scatter',
  'chat-react-turn',
  'conversation',
  'scratch-chat',
] as const;


export type AixDebugObject = ReturnType<typeof _createDebugConfig>;

export function _createDebugConfig(access: AixAPI_Access, options: undefined | { debugDispatchRequest?: boolean, debugProfilePerformance?: boolean }, chatGenerateContextName: string) {
  const echoRequest = !!options?.debugDispatchRequest && (AIX_SECURITY_ONLY_IN_DEV_BUILDS || AIX_INSPECTOR_ALLOWED_CONTEXTS.includes(chatGenerateContextName));
  const consoleLogErrors =
    (access.dialect === 'openai' && access.oaiHost) ? false as const // do not server-log OpenAI Custom hosts (often self-hosted and buggy) from server-side console error logging
      : 'srv-warn' as const; // keeping the highest level of server-side logging for 'fetching' issues (usually however we see the messages of the TRPC retrier `createRetryablePromise` already)
  return {
    prettyDialect: serverCapitalizeFirstLetter(access.dialect), // string
    echoRequest: echoRequest, // boolean
    consoleLogErrors,
    profiler: AIX_SECURITY_ONLY_IN_DEV_BUILDS && echoRequest && !!options?.debugProfilePerformance ? new PerformanceProfiler() : undefined, // PerformanceProfiler | undefined
    wire: createServerDebugWireEvents() ?? undefined, // ServerDebugWireEvents | undefined
  };
}