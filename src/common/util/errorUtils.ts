import { Release } from '~/common/app.release';

/**
 * Present an error to the user in a human-readable format.
 * Be exhaustive and not repetitive. Ignore the stack trace.
 */
export function presentErrorToHumans(error: any, mdBold: boolean = false, devWarnError: boolean = false): string {
  if (devWarnError)
    console.error('presentErrorToHumans', { errorType: typeof error, isError: error instanceof Error, error: error });

  // Handle Error objects
  if (error instanceof Error) {
    let message = error.name ? `[${error.name}] ` : '';
    message += error.message;
    if (mdBold)
      message = `**${message}**`;

    if (error.cause) {
      // shallow print of the message only
      if (error.cause instanceof Error)
        message += ` · cause: ${error.cause.message}.`;
      // to print it fully (not recommended), use the following:
      // message += ` · cause: ${presentErrorToHumans(error.cause)}`;
    }

    return message;
  }

  // Handle DOMException
  if (error instanceof DOMException)
    return `[DOMException] ${error.name}: ${error.message}`;

  // Handle string errors
  if (typeof error === 'string')
    return error;

  // Handle objects
  if (typeof error === 'object' && error !== null)
    return safeObjectToString(error);

  // Handle other types
  return `Unknown Error: ${String(error)} (type: ${typeof error})`;
}

function safeObjectToString(obj: object): string {
  const pairs: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    let valueStr: string;
    if (typeof value === 'object' && value !== null) {
      valueStr = '[Object]';
    } else if (typeof value === 'function') {
      valueStr = '[Function]';
    } else {
      valueStr = String(value);
    }
    pairs.push(`${key}: ${valueStr}`);
  }
  return `{ ${pairs.join(', ')} }`;
}


/**
 * Serialize an error object to a plain object for storage or transmission.
 */
export function serializeError(value: any): any {
  // handle Error objects
  if (value instanceof Error) {
    return {
      _isError: true,  // Mark as serialized error for identification
      name: value.name ?? 'SError',
      message: value.message ?? 'No SMessage',
      ...(value.stack !== undefined && { stack: value.stack }), // Include stack if available
      ...(value.cause !== undefined && { cause: serializeError(value.cause) }), // Recursively serialize cause
      // Capture other properties
      ...Object.fromEntries(
        Object.entries(value).filter(([k]) => !['name', 'message', 'stack', 'cause'].includes(k)),
      ),
    };
  }

  // handle objects that might contain errors
  if (value && typeof value === 'object') {
    if (Array.isArray(value)) {
      return value.map(serializeError);
    }

    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serializeError(val);
    }
    return result;
  }

  // Return primitives as-is
  return value;
}

/**
 * Conditionally triggers the debugger
 */
export function maybeDebuggerBreak(): void {

  const isBreakEnabled = process.env.NEXT_PUBLIC_DEBUG_BREAKS === 'true';

  if (Release.IsNodeDevBuild && isBreakEnabled) {
    // eslint-disable-next-line no-debugger
    debugger; // This line will be hit only if DevTools are open.
    // Build tools often remove debugger statements in production.
  }
}
