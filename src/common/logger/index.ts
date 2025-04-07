// re-export the core functionality
export type { LogEntry, LogLevel, LogSource } from './logger.types';

// re-export the global handlers
export { setupClientFetchErrorsLogging } from './interceptors/logger.network';
export { setupClientUncaughtErrorsLogging } from './interceptors/logger.unhandled';

// re-export the core functionality
export { logger } from './logger.client';

// re-export the module logger factory
export type { ClientLogger } from './logger.types';
export { createModuleLogger } from './logger.factory';
