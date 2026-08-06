import EventEmitter from 'eventemitter3';

import { Release } from '~/common/app.release';
import { agiUuid } from '~/common/util/idUtils';
import { logger } from '~/common/logger';

import type { EventData, EventDomainName, EventListener, EventName, EventPayload, EventUnsubscribe, WildcardEventListener } from './events.types';


type EventExtraOptions = {
  source?: string;
  correlationId?: string;
}


type EventHistoryEntry = {
  domain: string;
  name: string;
  payload: EventPayload<unknown>;
}


export class EventBus {

  // core
  #emitter = new EventEmitter();
  #wildcardListeners: WildcardEventListener[] = [];

  // debugging
  #debug = false;
  #debugHistory: EventHistoryEntry[] = [];
  #debugHistoryLimit = 1000;


  /** Emit a domain-specific event */
  emit<D extends EventDomainName, E extends EventName<D>>(
    domain: D,
    name: E,
    data: EventData<D, E>,
    options: EventExtraOptions = {},
  ): string {

    const fullEventName = `${String(domain)}:${String(name)}`;
    const payload: EventPayload<EventData<D, E>> = {
      id: agiUuid('event-id'),
      timestamp: Date.now(),
      ...options,
      data,
    };

    if (this.#debug) {
      this.#debugHistory.push({
        domain: String(domain),
        name: String(name),
        payload,
      });
      if (this.#debugHistory.length > this.#debugHistoryLimit)
        this.#debugHistory.shift();
    }

    this.#emitter.emit(fullEventName, payload);

    for (const listener of this.#wildcardListeners) {
      try {
        listener(String(domain), String(name), payload);
      } catch (error) {
        logger.error(`Error in wildcard listener for ${fullEventName}:`, error);
        // NOTE: re-throw?
      }
    }

    return payload.id;
  }

  /** Listen for domain-specific events */
  on<D extends EventDomainName, E extends EventName<D>>(
    domain: D,
    name: E,
    listener: EventListener<D, E>,
  ): EventUnsubscribe {

    const fullEventName = `${String(domain)}:${String(name)}`;

    const wrappedListener = (payload: EventPayload<EventData<D, E>>) => {
      try {
        listener(payload);
      } catch (error) {
        logger.error(`Error in listener for ${fullEventName}:`, error);
        // NOTE: re-throw?
      }
    };

    this.#emitter.on(fullEventName, wrappedListener);

    return () => {
      this.#emitter.off(fullEventName, wrappedListener);
    };
  }

  /** Listen for an event once */
  once<D extends EventDomainName, E extends EventName<D>>(
    domain: D,
    name: E,
    listener: EventListener<D, E>,
  ): EventUnsubscribe {

    const fullEventName = `${String(domain)}:${String(name)}`;

    const wrappedListener = (payload: EventPayload<EventData<D, E>>) => {
      try {
        listener(payload);
      } catch (error) {
        logger.error(`Error in once listener for ${fullEventName}:`, error);
        // NOTE: re-throw?
      }
    };

    this.#emitter.once(fullEventName, wrappedListener);

    return () => {
      this.#emitter.off(fullEventName, wrappedListener);
    };
  }

  /** FOR DEBUG ONLY - listen for all events across all domains */
  onAny(listener: WildcardEventListener): EventUnsubscribe {
    this.#wildcardListeners.push(listener);

    return () => {
      const index = this.#wildcardListeners.indexOf(listener);
      if (index !== -1)
        this.#wildcardListeners.splice(index, 1);
    };
  }


  /** Clear all listeners and history */
  dispose(): void {
    this.#emitter.removeAllListeners();
    this.#wildcardListeners = [];
    this.#debugHistory = [];
  }

  /** Create a domain-specific helper */
  forDomain<D extends EventDomainName>(domain: D): DomainEventHelper<D> {
    return new DomainEventHelper<D>(this, domain);
  }


  // /** Create an event flow for tracking related events */
  // createFlow(flowId = crypto.randomUUID()): EventFlow {
  //   return new EventFlow(flowId, this);
  // }


  /** Enable debug mode which retains a history of emitted events */
  enableDebug(enabled = true, historyLimit = 1000): void {
    this.#debug = enabled;
    this.#debugHistoryLimit = historyLimit;
    if (!enabled)
      this.#debugHistory = [];
  }

  /** Get event history (only available in debug mode) */
  getDebugEventHistory(filter?: {
    domain?: string;
    name?: string;
    since?: number;
  } & EventExtraOptions): EventHistoryEntry[] {
    if (!this.#debug) {
      console.warn('Event history is only available when debug mode is enabled');
      return [];
    }

    if (!filter)
      return [...this.#debugHistory];

    return this.#debugHistory.filter(entry => {
      if (filter.domain && entry.domain !== filter.domain) return false;
      if (filter.name && entry.name !== filter.name) return false;
      if (filter.since && entry.payload.timestamp < filter.since) return false;
      if (filter.source && entry.payload.source !== filter.source) return false;
      return !(filter.correlationId && entry.payload.correlationId !== filter.correlationId);
    });
  }

}


/**
 * Helper class for working with a specific domain
 * Collects unsubscribe functions and provides a single dispose method to prevent memory leaks
 */
export class DomainEventHelper<D extends EventDomainName> {
  private readonly unsubscribeFunctions: EventUnsubscribe[] = [];

  constructor(
    protected readonly bus: EventBus,
    protected readonly domain: D,
  ) {
  }

  /** Emit an event in this domain */
  emit<E extends EventName<D>>(
    name: E,
    data: EventData<D, E>,
    options: EventExtraOptions = {},
  ): string {
    return this.bus.emit(this.domain, name, data, options);
  }

  /** Listen for an event in this domain */
  on<E extends EventName<D>>(
    name: E,
    listener: EventListener<D, E>,
  ): EventUnsubscribe {
    const unsubscribe = this.bus.on(this.domain, name, listener);
    this.unsubscribeFunctions.push(unsubscribe);
    return () => {
      const index = this.unsubscribeFunctions.indexOf(unsubscribe);
      if (index !== -1)
        this.unsubscribeFunctions.splice(index, 1);
      unsubscribe();
    };
  }

  /** Listen for an event once in this domain */
  once<E extends EventName<D>>(
    name: E,
    listener: EventListener<D, E>,
  ): EventUnsubscribe {
    const unsubscribe = this.bus.once(this.domain, name, listener);
    this.unsubscribeFunctions.push(unsubscribe);
    return () => {
      const index = this.unsubscribeFunctions.indexOf(unsubscribe);
      if (index !== -1)
        this.unsubscribeFunctions.splice(index, 1);
      unsubscribe();
    };
  }

  /** Dispose of this helper and unsubscribe from all events */
  disposeUnsubscribeAll(): void {
    for (const unsubscribe of this.unsubscribeFunctions)
      unsubscribe();
    this.unsubscribeFunctions.length = 0;
  }
}


/**
 * Singleton App-wide Bus.
 *
 * Make sure to Unsubscribe from events even during unmounts/Domain lifecycle unmounts,
 * otherwise hot module reload could still dispatch to older instances in memory.
 */
export const appEvents = new EventBus();

// HMR handling - only runs in development when hot module replacement is active
// if (Release.IsNodeDevBuild && typeof module !== 'undefined' && 'hot' in module) {
//   logger.info(`~HMR detected: appEvents regenerated - some components may still be listening to the old EventBus.`);
//   (module.hot as any).dispose(() => ...);
// }
