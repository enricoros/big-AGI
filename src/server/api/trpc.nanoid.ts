import { nanoid } from 'nanoid';

/**
 * There's a copy of this function in src/common/util/idUtils.ts, but that one is for client-side use.
 * This one is for server-side use.
 */
export function serverSideId(_serverScope: 'aix-tool-call-id' | 'aix-tool-response-id', digits?: number) {
  return 'aix_' + nanoid(digits);
}
