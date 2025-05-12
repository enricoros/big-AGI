import { maybeDebuggerBreak, serializeError } from '~/common/util/errorUtils';

import type { ClientLogger, LogEntry, LogLevel, LogOptions, LogSource } from './logger.types';
import { LoggerActions, useLoggerStore } from './store-logger';


class LoggerImplementation implements ClientLogger {

  constructor(private readonly _actions: LoggerActions) {
  }

  // Level to method mapping

  DEV = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('DEV', message, details, source, options);

  debug = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('debug', message, details, source, options);

  info = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('info', message, details, source, options);

  warn = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('warn', message, details, source, options);

  error = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('error', message, details, source, options);

  critical = (message: string, details?: any, source?: LogSource, options?: LogOptions): string =>
    this.#log('critical', message, details, source, options);


  async executeAction(logId: string, actionId?: string): Promise<void> {

    const entry = this._actions.getEntry(logId);
    if (!entry?.actions?.length)
      throw new Error(`No actions available for log entry ${logId}`);

    // find the specific action to execute, or the first non-completed action
    const action = entry.actions.find(a => actionId ? a.id === actionId : !a.completed);
    if (!action)
      throw new Error(`No action found for log entry ${logId}`);

    if (actionId && action.completed)
      throw new Error(`Action ${actionId} already completed for log entry ${logId}`);

    try {
      await action.handler();
      this._actions.markActionCompleted(logId, action.id);
    } catch (error) {

      // log the failure but don't mark as completed
      this.error(
        `Failed to execute action "${action.label}" for log: ${entry.message}`,
        { error, originalLogId: logId },
        entry.source,
      );

      // re-throw for caller handling
      throw error;
    }
  }


  // Pass-through methods to store actions

  markActionCompleted = (logId: string, actionId?: string): void =>
    this._actions.markActionCompleted(logId, actionId);

  markDismissed = (logId: string): void =>
    this._actions.markDismissed(logId);

  getPendingActions = (): LogEntry[] =>
    this._actions.getPendingActionEntries();


  /// Internal ///

  #log(level: LogLevel, message: string, details?: any, source?: LogSource, options?: LogOptions): string {

    // if param 3 is an object but not a valid source, assume it's the options and source was omitted
    if (source && typeof source === 'object' && !options) {
      options = source as any;
      source = undefined;
    }

    // combine options
    const finalOptions = options || {};
    const finalSource = source || finalOptions.source || 'unknown';
    const finalDetails = serializeError(details || finalOptions.details); // serializeError because otherwise 'Error' wouldn't be serializable, and would appear as {}

    // prepare actions - handle both options.action and options.actions
    let actions = finalOptions.actions || [];
    if (finalOptions.action && !actions.length)
      actions = [finalOptions.action];

    // Add debugger break for error and critical levels
    if ((level === 'error' || level === 'critical' || level === 'DEV') && !finalOptions.skipDebuggerBreak)
      maybeDebuggerBreak();

    return this._actions._addEntry({
      level,
      message,
      details: finalDetails,
      source: finalSource,
      ...(actions.length > 0 ? { actions } : {}),
    });
  }

}

const _logger = new LoggerImplementation(useLoggerStore.getState());


/** Global logger instance */
export const logger = _logger;