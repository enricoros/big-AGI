import { SERVER_DEBUG_WIRE } from '~/server/wire';

import type { DemuxedEvent } from '../dispatch/dispatch.demuxers';
import type { DispatchMessageAction } from '../dispatch/dispatch.parsers';


// type IntakeProtoObject = IntakeControlProtoObject | IntakeEventProtoObject;
// type IntakeControlProtoObject = { type: 'start' | 'done' };
type IntakeEventProtoObject =
  | { t: string }
  | { set: { model?: string } }


/**
 * Handles the downstream of the AIX router.
 */
export class IntakeHandler {
  private dispatchReceivedEvents: number = 0;
  private debugReceivedLastMs: number | null = null;
  public intakeTerminated: boolean = false;

  constructor(readonly prettyDialect: string) {
    // ...
  }


  * yieldStart() {
    yield {
      type: 'start',
    };
  }

  * yieldTermination(reasonId: 'dispatch-close' | 'event-done' | 'parser-done') {
    if (SERVER_DEBUG_WIRE || true)
      console.log('|terminate|', reasonId, this.intakeTerminated ? '(WARNING: already terminated)' : '');
    if (this.intakeTerminated) return;
    yield {
      type: 'done',
    };
    this.intakeTerminated = true;
  }

  * yieldOp(op: IntakeEventProtoObject) {
    yield op;
  }

  * yieldDmaOps(parsedEvents: Generator<DispatchMessageAction>, prettyDialect: string) {
    for (const dma of parsedEvents) {
      // console.log('parsed dispatch:', dma);
      // TODO: massively rework this into a good protocol
      if (dma.op === 'parser-close') {
        yield* this.yieldTermination('parser-done');
        break;
      } else if (dma.op === 'text') {
        yield* this.yieldOp({
          t: dma.text,
        });
      } else if (dma.op === 'issue') {
        yield* this.yieldOp({
          t: ` ${dma.symbol} **[${prettyDialect} Issue]:** ${dma.issue}`,
        });
      } else if (dma.op === 'set') {
        yield* this.yieldOp({
          set: dma.value,
        });
      } else {
        // shall never reach this
        console.error('Unexpected stream event:', dma);
      }
    }
  }

  * yieldError(errorId: 'dispatch-prepare' | 'dispatch-fetch' | 'dispatch-read' | 'dispatch-parse', errorText: string, forceConsoleMessage?: boolean) {
    if (SERVER_DEBUG_WIRE || forceConsoleMessage || true)
      console.error(`[POST] Aix.${this.prettyDialect} (${errorId}): ${errorText}`);
    yield {
      issueId: errorId,
      issueText: errorText,
    };
    this.intakeTerminated = true;
  }


  markTermination() {
    this.intakeTerminated = true;
  }

  onReceivedDispatchEvent(demuxedEvent: DemuxedEvent) {
    this.dispatchReceivedEvents++;
    if (SERVER_DEBUG_WIRE) {
      const nowMs = Date.now();
      const elapsedMs = this.debugReceivedLastMs ? nowMs - this.debugReceivedLastMs : 0;
      this.debugReceivedLastMs = nowMs;
      console.log(`<- SSE (${elapsedMs} ms):`, demuxedEvent);
    }
  }

}
