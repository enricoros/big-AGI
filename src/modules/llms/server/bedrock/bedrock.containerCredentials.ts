/**
 * Ambient AWS credentials from the container credentials endpoint (ECS/Fargate task roles).
 *
 * Zero-dependency and Edge Runtime compatible: only `fetch` and env vars are used (no AWS
 * SDK, no filesystem, no Node APIs). Opt-in via BEDROCK_USE_CONTAINER_CREDENTIALS=true.
 *
 * Supported (the "container" credential provider - https://docs.aws.amazon.com/sdkref/latest/guide/feature-container-credentials.html):
 * - ECS/Fargate task roles: AWS_CONTAINER_CREDENTIALS_RELATIVE_URI, served by the ECS agent
 *   at the link-local address http://169.254.170.2
 * - AWS_CONTAINER_CREDENTIALS_FULL_URI, with the optional static AWS_CONTAINER_AUTHORIZATION_TOKEN
 *
 * NOT supported (would need more machinery than a fetch):
 * - EC2 IMDSv2 (different token+discovery protocol)
 * - EKS IRSA (requires an STS AssumeRoleWithWebIdentity call)
 * - EKS Pod Identity (AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE rotates on disk; the Edge Runtime has no fs)
 *
 * Lifecycle: task-role credentials rotate (~hours), so we cache at module level, refresh with
 * a safety margin before expiration, single-flight concurrent refreshes, and keep serving the
 * cached credentials on refresh failures for as long as they are still valid.
 */

// configuration
const _ECS_CREDENTIALS_HOST = 'http://169.254.170.2'; // ECS agent, link-local
const _EXPIRY_MARGIN_MS = 5 * 60 * 1000; // refresh 5 minutes before expiration
const _FETCH_TIMEOUT_MS = 5 * 1000; // generous - the endpoint is link-local (measured <100ms)


export interface BedrockContainerCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string | undefined; // always present on ECS task roles, but not required for signing
  expiresAt: number; // epoch ms
}

// module-level cache - persists across invocations within the server (or Edge sandbox) instance
let _cache: BedrockContainerCredentials | null = null;
let _inflightRefresh: Promise<BedrockContainerCredentials> | null = null;
let _loggedFirstUse = false;


/** True when the runtime exposes a container credentials endpoint (e.g. ECS/Fargate with a task role). */
export function bedrockHasContainerCredentialsEndpoint(): boolean {
  return !!process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI || !!process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
}

/**
 * Returns valid (cached or freshly fetched) container credentials, or null when unavailable,
 * letting the caller fall through to its standard missing-credentials error.
 */
export async function bedrockContainerCredentialsOrNull(): Promise<BedrockContainerCredentials | null> {

  // fresh cache hit
  if (_cache && Date.now() < _cache.expiresAt - _EXPIRY_MARGIN_MS)
    return _cache;

  // single-flight: concurrent requests await the same refresh
  if (!_inflightRefresh)
    _inflightRefresh = _fetchContainerCredentials().finally(() => _inflightRefresh = null);

  try {
    _cache = await _inflightRefresh;
    return _cache;
  } catch (error: any) {
    // stale-tolerant: on refresh failure keep serving cached credentials until they actually expire
    if (_cache && Date.now() < _cache.expiresAt)
      return _cache;
    console.warn('[Bedrock] container credentials unavailable:', error?.message || error);
    return null;
  }
}

async function _fetchContainerCredentials(): Promise<BedrockContainerCredentials> {

  // resolve the endpoint
  const relativeUri = process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI;
  const url = relativeUri ? _ECS_CREDENTIALS_HOST + relativeUri : process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI;
  if (!url)
    throw new Error('no container credentials endpoint (AWS_CONTAINER_CREDENTIALS_RELATIVE_URI/_FULL_URI unset)');

  // optional static authorization token (the rotating _TOKEN_FILE variant is not supported - see header)
  const authToken = process.env.AWS_CONTAINER_AUTHORIZATION_TOKEN;

  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      ...(authToken ? { 'Authorization': authToken } : {}),
    },
    signal: AbortSignal.timeout(_FETCH_TIMEOUT_MS),
  });
  if (!response.ok)
    throw new Error(`credentials endpoint returned HTTP ${response.status}`);

  const wireCreds = await response.json() as { RoleArn?: string; AccessKeyId?: string; SecretAccessKey?: string; Token?: string; Expiration?: string };
  if (!wireCreds?.AccessKeyId || !wireCreds.SecretAccessKey || !wireCreds.Expiration)
    throw new Error('credentials endpoint returned an unexpected payload');

  const expiresAt = Date.parse(wireCreds.Expiration);
  if (isNaN(expiresAt))
    throw new Error(`credentials endpoint returned an invalid Expiration: ${wireCreds.Expiration}`);

  // log once, as operational evidence of the ambient auth mode
  if (!_loggedFirstUse) {
    _loggedFirstUse = true;
    console.log(`[Bedrock] using container credentials${wireCreds.RoleArn ? ` (role: ${wireCreds.RoleArn})` : ''}, expiring ${wireCreds.Expiration}`);
  }

  return {
    accessKeyId: wireCreds.AccessKeyId,
    secretAccessKey: wireCreds.SecretAccessKey,
    sessionToken: wireCreds.Token || undefined,
    expiresAt,
  };
}
