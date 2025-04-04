/**
 * Base event payload structure
 */
export interface EventPayload<T /*= unknown*/> {
  id: string;             // unique ID
  timestamp: number;      // when the event was emitted
  source?: string;        // optional component/module that emitted the event
  correlationId?: string; // optional for tracking related events
  data: T;                // event-specific data
}

/**
 * !!! Augmentation Target for Events (domains, events, data) extension !!!
 * Domain registry - Extended via module augmentation by each domain
 */
export interface EventDomains {
  // default: nothing
}


export type EventDomainName = keyof EventDomains;

export type EventName<D extends EventDomainName> = keyof EventDomains[D];
export type EventData<D extends EventDomainName, E extends EventName<D>> = EventDomains[D][E];

export type FullEventName<D extends EventDomainName, E extends EventName<D>> =
  `${string & D}:${string & E}`;


export type EventListener<D extends EventDomainName, E extends EventName<D>> =
  (event: EventPayload<EventData<D, E>>) => void;

export type WildcardEventListener =
  (domain: string, name: string, event: EventPayload<unknown>) => void;

export type EventUnsubscribe = () => void;
