import { logger } from '~/common/logger';

import type { EventData, EventDomainName, EventName, EventUnsubscribe } from './events.types';
import { appEvents, DomainEventHelper } from './events.bus';

/**
 * LiveEventState vs Regular Events: When to use each
 *
 * Stateful Events (this file):
 * - Maintain a current value that can be accessed immediately (state.value)
 * - Notify new subscribers with the current value right away
 * - Represent ongoing conditions/properties (network status, theme, auth state)
 * - Use when components need the current state immediately upon mounting
 *
 * Regular Events (events.bus.ts):
 * - Signal one-time actions or changes (button clicks, sync started/completed)
 * - No state retention between emissions
 * - More flexible data structures specific to each event
 * - Use for triggering processes or broadcasting notifications
 *
 * StatefulEventsManager vs LiveEventState:
 *
 * The StatefulEventsManager is a factory that creates and manages LiveEventState
 * instances for a specific domain. Each LiveEventState holds the actual state value.
 *
 * Example:
 *
 * // 1. Create a state manager for the 'ui' domain
 * const uiEvents = createStatefulEventsManagerFor('ui');
 *
 * // 2. Create a live state for theme preference
 * const themeState = uiEvents.createLiveEventState<'theme:changed', 'light' | 'dark' | 'system'>(
 *   'theme:changed',  // Event name
 *   'system',         // Initial value
 *   'ThemeManager'    // Source label
 * );
 *
 * // 3. Access the current value anywhere
 * const currentTheme = themeState.value;  // 'system'
 *
 * // 4. Update the value (will notify subscribers and emit an event)
 * themeState.update('dark');
 *
 * // 5. Subscribe to changes (immediately gets current value + future updates)
 * const unsubscribe = themeState.subscribe(theme => {
 *   console.log(`Theme changed to: ${theme}`);  // 'Theme changed to: dark'
 * });
 *
 * // 6. Clean up when done
 * unsubscribe();
 */

export interface LiveEventStateData<TValue> {
  value: TValue;
  previousValue: TValue;

  [key: string]: any;
}


/**
 * Manager for LiveEventState instances in a specific domain
 */
export class StatefulEventsManager<
  Dn extends EventDomainName
> extends DomainEventHelper<Dn> {

  #namedLiveStates = new Map<string, LiveEventState<any, Dn, any>>();

  /** Create or get a live state for a specific event */
  createLiveEventState<En extends EventName<Dn>, TValue>(
    eventName: En,
    initialValue: TValue,
    sourceLabel?: string,
  ): LiveEventState<TValue, Dn, En> {
    const key = String(eventName);

    if (!this.#namedLiveStates.has(key)) {
      const liveEventState = new LiveEventState<TValue, Dn, En>(
        initialValue,
        this.domain,
        eventName,
        sourceLabel,
      );
      this.#namedLiveStates.set(key, liveEventState);
    }

    return this.#namedLiveStates.get(key) as LiveEventState<TValue, Dn, En>;
  }

  /** Get a live state if it exists */
  getLiveEventState<E extends EventName<Dn>, TValue>(eventName: E): LiveEventState<TValue, Dn, E> | undefined {
    return this.#namedLiveStates.get(String(eventName)) as LiveEventState<TValue, Dn, E> | undefined;
  }

  /** Remove a live state and dispose its resources */
  removeLiveEventState<E extends EventName<Dn>>(eventName: E): boolean {
    const key = String(eventName);
    const state = this.#namedLiveStates.get(key);

    if (state) {
      state.dispose();
      this.#namedLiveStates.delete(key);
      return true;
    }

    return false;
  }

  /** Clean up all live states in this domain */
  disposeAll(): void {
    for (const state of this.#namedLiveStates.values())
      state.dispose();
    this.#namedLiveStates.clear();
  }
}


/**
 * A live state value that can be observed with automatic notifications
 *
 * NOTE: For proper type safety, ensure all domain events that will be used with LiveEventState
 *
 * conform to the LiveEventStateData<TValue> interface, which includes:
 * - value: TValue - The current state value
 * - previousValue: TValue - The previous state value
 * - ...any additional metadata
 *
 * The type casting to EventData<Dn, En> is necessary because TypeScript doesn't allow
 * us to constrain En to only event names with compatible data structures at the class level.
 *
 * When defining domain events meant for state usage, use this pattern:
 * ```typescript
 * declare module './events.types' {
 *   interface EventDomains {
 *     'domain': {
 *       'event:name': LiveEventStateData<YourValueType>;
 *     }
 *   }
 * }
 * ```
 */
export class LiveEventState<
  TValue,
  Dn extends EventDomainName,
  En extends EventName<Dn> = EventName<Dn>, // auto
  TListener extends (value: TValue) => void = (value: TValue) => void, // auto
> {

  #currentValue: TValue;
  #listeners = new Set<TListener>();

  constructor(
    initialValue: TValue,
    private readonly domainName: Dn,
    private readonly eventName: En,
    private readonly sourceLabel?: string, // sets the event source optional param, or 'LiveEventState'
  ) {
    this.#currentValue = initialValue;
  }

  /** Get current value */
  get value(): Readonly<TValue> {
    return this.#currentValue;
  }

  /** Sets the current value and emits */
  update(newValue: TValue, metadata: { [key: string]: any } = {}): void {

    // shallow-check for change, or skip
    if (newValue === this.#currentValue) return;

    const oldValue = this.#currentValue;
    this.#currentValue = newValue;

    this.#listeners.forEach(listener => {
      try {
        listener(newValue);
      } catch (error) {
        logger.error(`Error in LiveEventState listener for ${this.domainName}:${String(this.eventName)}:`, error);
        // NOTE: re-throw?
      }
    });

    // emit the change event
    appEvents.emit(
      this.domainName,
      this.eventName,
      ({
        value: newValue,
        previousValue: oldValue,
        ...metadata,
      } satisfies LiveEventStateData<TValue>) as EventData<Dn, En>,
      { source: this.sourceLabel || 'LiveEventState' },
    );
  }

  /** Subscribe to changes, immediately receiving the current value */
  subscribe(listener: TListener): EventUnsubscribe {
    this.#listeners.add(listener);

    try {
      listener(this.#currentValue);
    } catch (error) {
      logger.error(`Error in initial LiveEventState callback:`, error);
      // NOTE: re-throw?
    }

    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Clean up all listeners */
  dispose(): void {
    this.#listeners.clear();
  }
}


/** Create a state manager for a specific domain */
export function createStatefulEventsManagerFor<D extends EventDomainName>(domain: D): StatefulEventsManager<D> {
  return new StatefulEventsManager<D>(appEvents, domain);
}
