import type { ParticleServerLogLevel } from './IParticleTransmitter';


const _userSideHttpCodes = [401, 402, 403, 404, 429]; // [OpenRouter] mirrors the upstream HTTP status in `code` - coincidentally aligned with the 'dispatch-fetch' demotion in chatGenerate.executor.ts
const _userSideErrorCodes = ['invalid_api_key', 'account_deactivated', 'insufficient_quota', 'billing_not_active', 'billing_hard_limit_reached', 'unsupported_country_region_territory', 'model_not_found', 'rate_limit_exceeded', 'content_policy_violation', 'content_filter', 'moderation_blocked', 'invalid_prompt'];
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
