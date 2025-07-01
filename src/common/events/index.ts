import { Release } from '~/common/app.release';
import { logger } from '~/common/logger';

import type { EventData, EventDomainName, EventName } from './events.types';
import { appEvents } from './events.bus';


// re-export types
export type { EventPayload, EventDomains, EventDomainName, EventName, EventData, EventListener, EventUnsubscribe } from './events.types';

// re-export event bus
export { appEvents, DomainEventHelper, EventBus } from './events.bus';

// re-export live event state
export type { LiveEventStateData } from './events.stateful';
export { LiveEventState, StatefulEventsManager, createStatefulEventsManagerFor } from './events.stateful';


// configuration
const EVENTS_DEBUG_ENABLE = false;


/** Type-safe helper to emit events */
export function appEmitEvent<D extends EventDomainName, E extends EventName<D>>(
  domain: D,
  name: E,
  data: EventData<D, E>,
  options?: {
    source?: string;
    correlationId?: string;
  },
): string {
  return appEvents.emit(domain, name, data, options);
}


// Future: domain-specific exports
// export { networkEvents, networkConnected, initNetworkMonitor } from './domains/network';
// export { uiEvents, currentTheme, sidebarState } from './domains/ui';
// export function initEventSystem(): void {
//   initNetworkMonitor();
//   console.log('[EventSystem] Initialized');
// }

// Enable debugging in development
if (EVENTS_DEBUG_ENABLE && Release.IsNodeDevBuild) {
  appEvents.enableDebug(true);
  appEvents.onAny((domain, name, payload) =>
    logger.debug(`[Event] ${domain}:${name}`, payload.data),
  );
}