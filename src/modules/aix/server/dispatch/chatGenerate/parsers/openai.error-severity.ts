import type { ParticleServerLogLevel } from './IParticleTransmitter';


/**
 * Classification of the error objects OpenAI and the OpenAI-compatible endpoints relay in-band, on a 200:
 * how loud to log them (openAIUpstreamErrorLogLevel) and whether the operation retrier re-runs the dispatch
 * (openAITransientErrorToHttpStatus). Both parsers feed every carrier here: the Responses 'error' event and
 * 'response.failed', the Chat Completions `{ error }` chunk, and the non-streaming `{ error }` bodies of both.
 */


const _userSideHttpCodes = [401, 402, 403, 404, 429]; // [OpenRouter] mirrors the upstream HTTP status in `code` - coincidentally aligned with the 'dispatch-fetch' demotion in chatGenerate.executor.ts
const _userSideErrorCodes = [
  'invalid_api_key', 'account_deactivated', 'insufficient_quota', 'billing_not_active', 'billing_hard_limit_reached', 'unsupported_country_region_territory', 'model_not_found', 'rate_limit_exceeded', 'content_policy_violation', 'content_filter', 'moderation_blocked', 'invalid_prompt',
  'resource_unavailable', // [OpenAI] flex capacity shortage (#1211): reaches the log only once the retries below are spent - an upstream condition, not an adapter bug
];
const _userSideErrorTypes = ['authentication_error', 'permission_error', 'insufficient_quota', 'rate_limit_error', 'tokens', 'requests'];

/**
 * 'srv-log' for user/key/policy rejections relayed in-band by OpenAI and compatible endpoints (bad key,
 * billing, region, unknown model, rate limits, content policy); 'srv-warn' for anything unrecognized,
 * as it can signal adapter bugs (e.g. invalid_request_error on a request we generated).
 */
export function openAIUpstreamErrorLogLevel(error: null | undefined | { code?: string | number | null, type?: string | null }): ParticleServerLogLevel {
  const { code, type } = error || {};
  return (_userSideHttpCodes.includes(Number(code))
    || (typeof code === 'string' && _userSideErrorCodes.includes(code))
    || (typeof type === 'string' && _userSideErrorTypes.includes(type)))
    ? 'srv-log' : 'srv-warn';
}


/**
 * HTTP-equivalent status of a transient in-band error worth an operation retry, or undefined to surface it as it is.
 *
 * Where this sits. Three loops wrap a chat generation (chatGenerate.continuation.ts draws the composition):
 *  - above: executeChatGenerateWithContinuation - not a retry: it appends a fresh dispatch when a provider pauses a turn.
 *  - here:  executeChatGenerateWithOperationRetry - the operation retrier this function feeds. The parser throws
 *           OperationRetrySignal with the status returned here; the retrier yields an 'aix-retry-reset' particle
 *           (rScope 'srv-op', rClearStrategy 'since-checkpoint': the client drops this attempt's fragments and shows
 *           "<label> - retrying in Ns - n/N"), waits out the backoff while heartbeating, then calls the dispatch creator
 *           again and re-runs from zero: a new HTTP request, a new connect loop, a new parser instance.
 *  - below: fetchWithAbortableConnectionRetry (trpc.fetchers.retrier.ts) - the connect retrier, inside every operation
 *           attempt: connection failures and HTTP 429 (less a billing/quota denylist), 502, 503, 529, all before a byte of
 *           body is parsed. A parser only runs on a 200, so an error reaches here exactly when the connect retrier could
 *           not see it: the two never retry the same failure, and each operation attempt gets a full connect budget of its own.
 *  The stack is the same over tRPC (aix.router.ts) and CSF (aix.client.direct-chatGenerate.ts runs it in the browser).
 *  Above both, AixStreamRetry covers transport drops only and runs with 0 attempts: what this stack gives up on is final.
 *
 * What the status does. The retrier does not decide on it, it picks the schedule by it (upstreamRetryProfile, one table
 * shared with the connect retrier), unless the upstream code names a condition with a profile of its own:
 *    429  -> rateLimited: 6 attempts, ~2s..20s between them, ~50s in all (a per-minute window has to roll)
 *    529  -> overloaded:  6 attempts, ~1s..15s, ~30s in all (load shedding clears in tens of seconds)
 *    else -> transient:   4 attempts, ~1s, 2s, 4s, ~7s in all (a blip clears in seconds, or it is not clearing)
 *    code 'resource_unavailable' -> flexBusy: 4 attempts, ~2s, 4s, 8s, ~14s in all, shown calmly (the row below)
 * The parser asks context.hasRetriesForHttpStatus(status, code) before throwing: on the last attempt the answer is false and
 * the parser surfaces the vendor text itself, at openAIUpstreamErrorLogLevel - so a classified code also needs its row
 * in the log-level table above, or the final failure logs as a suspected adapter bug. The status also rides the particle
 * as causeHttp, the code as causeConn, for analytics.
 *
 * Why no denylist, unlike the connect retrier's 429 handling: an in-band error on a 200 stream is past admission, where
 * auth, quota, billing and request-size rejections happen. Those arrive as HTTP statuses and never reach a parser.
 *
 * Rows. The name of the failure sits in `code` or in `type` depending on the carrier ('response.failed' sends
 * { code, message }, the 'error' event and the HTTP bodies add `type`), so both are read:
 *  - rate_limit_exceeded, or the "processing too many requests" wording (#1210): a rate limit relayed after the 200,
 *    shape { type: 'invalid_request_error', code: 'rate_limit_exceeded' }.
 *  - server_is_overloaded, service_unavailable_error: OpenAI's overload pair, documented as an HTTP 503; reported as 529,
 *    the status of our 'overloaded' class (a bare 503 would read as transient).
 *  - server_error: a transient fault, 500.
 *  - resource_unavailable: flex processing (service_tier 'flex') has no capacity. "Flex processing is temporarily
 *    unavailable. Please try again later or use standard processing." Reported in #1211 on Beam rays that stayed empty,
 *    6 to 15+ minutes into an open stream: https://github.com/enricoros/big-AGI/issues/1211#issuecomment-6655396725.
 *    OpenAI documents it as an HTTP 429 Resource Unavailable, not billed, to be handled with "exponential backoff, or
 *    retry with service_tier auto/default"; on a streaming request it arrives in-band instead, an 'error' event with
 *    code 'resource_unavailable', since the 200 was committed at admission. Reported as 429, the documented status, as
 *    the analytics cause. The retry class is not the status's: the code selects a profile of its own, 'flexBusy' in the
 *    shared table - a busy best-effort tier is expected, not a fault, so a few spaced retries, a calm status named after
 *    the tier, then the vendor text, which names the way out. It is not a rate limit on the key (the rateLimited budget
 *    waits for a per-minute window to roll, which has no bearing on a capacity shortage, and would hold a Beam of N rays
 *    for most of a minute), and not an overload either (flex is best effort by contract).
 *    Hence the OpenAI call sites pass the code along with the status, to hasRetriesForHttpStatus and as the signal's
 *    causeConn: the parser and the retrier must size the attempts from the same profile. At admission the same shortage
 *    is an HTTP 429 with the same body code: the connect retrier matches it by httpErrorCode onto the same profile.
 *    Not done here: falling back to the standard tier by ourselves. The retrier re-runs the same dispatch; a tier switch
 *    is a different request at a different price, the user's call through the per-model service tier setting.
 */
export function openAITransientErrorToHttpStatus(error: null | undefined | { type?: string | null, code?: string | number | null, message?: string | null }): 429 | 500 | 529 | undefined {
  const names = [error?.code, error?.type];
  if (names.includes('rate_limit_exceeded') || /processing too many requests/i.test(error?.message || '')) return 429;
  if (names.includes('server_is_overloaded') || names.includes('service_unavailable_error')) return 529;
  if (names.includes('server_error')) return 500;
  if (names.includes('resource_unavailable')) return 429;
  return undefined;
}
