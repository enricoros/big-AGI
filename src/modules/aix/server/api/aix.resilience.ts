import { env } from '~/server/env.server';
import { objectDeepCloneWithStringLimit } from '~/common/util/objectUtils';


// Strict in dev (throws), more tolerant in prod (warns). Override with AIX_STRICT_PARSING=true.
// @see https://github.com/enricoros/big-AGI/issues/918

export function aixResilientUnknownValue(
  context: string,
  fieldName: string,
  value: unknown,
): false {
  const DO_THROW = env.AIX_STRICT_PARSING === 'true' || process.env.NODE_ENV === 'development'; // not using 'env' because in client-side code values are empty (mocked) - NOTE: test if this is true

  if (DO_THROW) {
    const safeValue = objectDeepCloneWithStringLimit(value, context, 1024);
    throw new Error(`[AIX.${context}] Unknown ${fieldName}: ${JSON.stringify(safeValue)}`);
  }

  console.warn(`[AIX.${context}|R] Unknown ${fieldName}:`, objectDeepCloneWithStringLimit(value, context, 4094));
  return false;
}
