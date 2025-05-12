/**
 * Client-side centralized logging system
 * For inspect-able and debuggable logs.
 */
export interface ClientLogger {

  // Logging methods (by level)
  DEV: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;
  debug: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;
  info: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;
  warn: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;
  error: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;
  critical: (message: string, details?: any, source?: LogSource, options?: LogOptions) => LogEntryId;

  /**
   * Execute an action associated with a log entry
   * @returns Promise that resolves when the action completes, or rejects if it fails (handler throws/rejects)
   */
  executeAction: (logId: LogEntryId, actionId?: LogActionId) => Promise<void>;

  /** Mark an action as completed without executing its handler */
  markActionCompleted: (logId: LogEntryId, actionId?: LogActionId) => void;
  /** Mark a log entry as dismissed */
  markDismissed: (logId: LogEntryId) => void;
  /** Get all log entries with pending actions */
  getPendingActions: () => LogEntry[];

}

export type LogLevel =
  | 'DEV'
  | 'debug'
  | 'info'
  | 'warn'
  | 'error'
  | 'critical';

export type LogSource =
  | 'unknown'   // DO NOT USE
  | 'unhandled' // uncaught exceptions
  | 'client'    // includes uncaught exceptions
  | 'network'   // network errors - includes the automatic fetch interceptor
// add new sources here as we continue using this system
// | 'server'
// | 'storage'
// | 'sync'
// | 'ai-service'
// | 'application'
  ;

/** Options object for logging methods */
export interface LogOptions {
  details?: any;
  source?: LogSource;
  action?: Omit<LogEntryAction, 'completed' | 'completedTimestamp'>; // Single action convenience
  actions?: Omit<LogEntryAction, 'completed' | 'completedTimestamp'>[]; // Multiple actions
  skipDebuggerBreak?: boolean; // Skip debugger break even if applicable to the level/build/env
}

/** Potential action associated with an entry */
export interface LogEntryAction {
  id?: LogActionId;             // optional action ID (for choosing which to execute on multiple actions)
  label: string;                // action button text
  handler: () => Promise<any>;  // async action handler
  completed?: boolean;          // (at the end) whether action was completed (via handler or manually)
  completedTimestamp?: number;  // when action was completed
}


export interface LogEntry {
  id: LogEntryId;
  timestamp: number;         // UNIX timestamp in ms
  level: LogLevel;           // Severity level
  source: LogSource;         // Origin component/system
  message: string;           // Human readable description
  details?: any;             // Optional structured data
  actions?: LogEntryAction[];     // Optional array of actions

  // State flags
  shown?: boolean;           // Whether displayed to user (for notifications)
  dismissed?: boolean;       // Whether explicitly dismissed by user
  hasPendingActions?: boolean; // Calculated flag: has actions not completed/dismissed
}

type LogEntryId = string;
type LogActionId = string;
