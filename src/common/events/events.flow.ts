// NOTE: Not needed for now, but kept for future reference in case we do
// Helper class for tracking a sequence of related events
//
// export class EventFlow {
//   private events: Array<{
//     domain: string;
//     name: string;
//     payload: EventPayload<unknown>;
//     timestamp: number;
//   }> = [];
//   readonly #startTime: number;
//   private endTime?: number;
//   readonly #cleanup: EventUnsubscribe;
//
//   constructor(
//     public readonly flowId: string,
//     private bus: EventBus,
//   ) {
//     this.#startTime = Date.now();
//
//     // Auto-track events with this correlation ID
//     this.#cleanup = this.bus.onAny((domain, name, payload) => {
//       if (payload.correlationId === this.flowId) {
//         this.events.push({
//           domain,
//           name,
//           payload,
//           timestamp: Date.now(),
//         });
//       }
//     });
//   }
//
//   // Emit an event as part of this flow
//   emit<D extends EventDomainName, E extends EventName<D>>(
//     domain: D,
//     name: E,
//     data: EventData<D, E>,
//     options: { source?: string } = {},
//   ): string {
//     return this.bus.emit(domain, name, data, {
//       ...options,
//       correlationId: this.flowId,
//     });
//   }
//
//   // Stop tracking and release resources
//   complete(): void {
//     this.endTime = Date.now();
//     this.#cleanup();
//   }
//
//   // Get the flow duration in milliseconds
//   get duration(): number {
//     return (this.endTime || Date.now()) - this.#startTime;
//   }
//
//   // Get all events in this flow
//   getEvents(): Array<{
//     domain: string;
//     name: string;
//     payload: EventPayload<unknown>;
//     timestamp: number;
//   }> {
//     return [...this.events];
//   }
// }
// export function createEventFlow(flowId = crypto.randomUUID()): EventFlow {
//   return appEvents.createFlow(flowId);
// }
