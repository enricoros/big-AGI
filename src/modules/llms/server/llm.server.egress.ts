import { egressAssertClientUrlOrThrow } from '~/server/egress.server';

import type { AixAPI_Access } from '~/modules/aix/server/api/aix.wiretypes';

import { anthropicAccess } from './anthropic/anthropic.access';
import { ollamaAccess } from './ollama/ollama.access';
import { openAIAccess } from './openai/openai.access';


/**
 * Server-side only: a client-set LLM host (Anthropic, Ollama, OpenAI-compatible) is fetched by this server, so it must pass
 * the outbound policy (no loopback/private/link-local/metadata unless in SERVER_ALLOWED_PRIVATE_HOSTS).
 *
 * Exempt: the dialect's own server endpoint (the env host, else the default, e.g. Ollama/LM Studio/LocalAI on localhost),
 * which the server already uses when the host is left empty - so local setups keep working with no configuration.
 */
export async function llmsAssertClientHostOrThrow(access: AixAPI_Access): Promise<void> {
  const clientHost = _clientHost(access);
  if (!clientHost) return;

  const serverEndpoint = _serverEndpointKey(access);
  if (serverEndpoint && _endpointKey(clientHost) === serverEndpoint) return;

  await egressAssertClientUrlOrThrow(clientHost, { kind: 'api-host', label: 'API host' });
}


function _clientHost(access: AixAPI_Access): string {
  switch (access.dialect) {
    case 'anthropic':
      return access.anthropicHost || '';
    case 'ollama':
      return access.ollamaHost;
    case 'bedrock':
    case 'gemini':
      return ''; // not covered here
    default:
      return access.oaiHost;
  }
}

/** The endpoint the server would call with no client host: the same access function, with the host cleared. */
function _serverEndpointKey(access: AixAPI_Access): string | null {
  try {
    switch (access.dialect) {
      case 'anthropic':
        return _endpointKey(anthropicAccess({ ...access, anthropicHost: null }, '').url);
      case 'ollama':
        return _endpointKey(ollamaAccess({ ...access, ollamaHost: '' }, '').url);
      case 'bedrock':
      case 'gemini':
        return null;
      default:
        return _endpointKey(openAIAccess({ ...access, oaiHost: '' }, null, '').url);
    }
  } catch {
    return null; // e.g. no server key or host configured
  }
}

/** hostname:port, with the loopback names folded together (localhost == 127.0.0.1 == [::1]). */
function _endpointKey(host: string): string | null {
  try {
    const url = new URL(host.startsWith('http') ? host : `https://${host}`);
    const hostname = ['localhost', '[::1]'].includes(url.hostname) ? '127.0.0.1' : url.hostname;
    return `${hostname}:${url.port || (url.protocol === 'https:' ? '443' : '80')}`;
  } catch {
    return null;
  }
}
