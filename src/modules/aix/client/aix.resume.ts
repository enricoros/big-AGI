import type { AixAPI_Access } from '../server/api/aix.wiretypes';

import { llmsHostnameMatches } from '~/modules/llms/server/openai/openai.access';


export function aixSupportsUpstreamReattach(access: AixAPI_Access): boolean {
  if (access.dialect !== 'openai')
    return false;

  const host = 'oaiHost' in access ? access.oaiHost : '';
  return !host
    || llmsHostnameMatches(host, 'api.openai.com')
    || llmsHostnameMatches(host, 'oai.hconeai.com');
}
