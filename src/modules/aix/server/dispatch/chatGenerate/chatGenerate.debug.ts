import { createDebugWireLogger, serverCapitalizeFirstLetter } from '~/server/wire';

import type { AixAPI_Access } from '../../api/aix.wiretypes';
import type { DAixIssue } from '../../../shared/aix.issues';
import { AIX_INSPECTOR_ALLOWED_CONTEXTS, AIX_SECURITY_ONLY_IN_DEV_BUILDS } from '../../api/aix.security';
import { PerformanceProfiler } from '../PerformanceProfiler';


// `runtime` is widened: the literal would narrow to 'relay' here, and the Direct Connection config says 'client'
export type AixDebugObject = Omit<ReturnType<typeof _createDebugConfig>, 'runtime'> & { runtime: NonNullable<DAixIssue['runtime']> };

export function _createDebugConfig(access: AixAPI_Access, options: undefined | { debugDispatchRequest?: boolean, debugProfilePerformance?: boolean, debugRequestBodyOverride?: Record<string, unknown> }, chatGenerateContextName: string) {
  const echoRequest = !!options?.debugDispatchRequest && (AIX_SECURITY_ONLY_IN_DEV_BUILDS || AIX_INSPECTOR_ALLOWED_CONTEXTS.includes(chatGenerateContextName));
  const consoleLogErrors =
    (access.dialect === 'openai' && access.oaiHost) ? false as const // do not server-log OpenAI Custom hosts (often self-hosted and buggy) from server-side console error logging
      : 'srv-warn' as const; // keeping the highest level of server-side logging for 'fetching' issues (the fetcher also logs each failed attempt, the retrier `fetchWithAbortableConnectionRetry` its retries)
  return {
    runtime: 'relay' as const, // where the executor runs: on the records of its connect and read failures
    prettyDialect: serverCapitalizeFirstLetter(access.dialect), // string
    echoRequest: echoRequest, // boolean
    requestBodyOverride: echoRequest ? options?.debugRequestBodyOverride : undefined,
    consoleLogErrors,
    profiler: AIX_SECURITY_ONLY_IN_DEV_BUILDS && echoRequest && !!options?.debugProfilePerformance ? new PerformanceProfiler() : undefined, // PerformanceProfiler | undefined
    wire: createDebugWireLogger('AIX') ?? undefined, // DebugWireLogger | undefined
  };
}