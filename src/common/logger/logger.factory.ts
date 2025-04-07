import type { ClientLogger, LogOptions, LogSource } from './logger.types';
import { logger } from './logger.client';


/**
 * Creates a module-specific logger with a predefined source and optional event prefix.
 *
 * @param source The source identifier for all logs from this module
 * @param eventPrefix Optional prefix to prepend to all log messages
 * @returns A logger instance with preset source and prefix
 */
export function createModuleLogger(source: LogSource | string, eventPrefix: string = ''): ClientLogger {
  // format message with prefix if provided
  const prefixMessage = eventPrefix
    ? (message: string): string => `${eventPrefix}: ${message}`
    : (message: string): string => message;

  return {
    DEV: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.DEV(prefixMessage('[DEV] ' + message), details, source as LogSource, options),

    debug: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.debug(prefixMessage(message), details, source as LogSource, options),

    info: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.info(prefixMessage(message), details, source as LogSource, options),

    warn: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.warn(prefixMessage(message), details, source as LogSource, options),

    error: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.error(prefixMessage(message), details, source as LogSource, options),

    critical: (message: string, details?: any, _overrideSource?: LogSource, options?: LogOptions) =>
      logger.critical(prefixMessage(message), details, source as LogSource, options),

    // forward action methods directly to the main logger
    executeAction: logger.executeAction,
    markActionCompleted: logger.markActionCompleted,
    markDismissed: logger.markDismissed,
    getPendingActions: logger.getPendingActions,
  };
}
