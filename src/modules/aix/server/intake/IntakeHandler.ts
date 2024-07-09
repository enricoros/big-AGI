import type { DemuxedEvent } from '../dispatch/dispatch.demuxers';
import { SERVER_DEBUG_WIRE } from '~/server/wire';


type IntakeProtoObject = IntakeControlProtoObject | IntakeEventProtoObject;
type IntakeControlProtoObject = { type: 'start' | 'done' };
type IntakeEventProtoObject =
  | { t: string }
  | { set: { model?: string } }


/**
 * Handles the downstream of the AIX server.
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

  * yieldError(errorId: 'dispatch-prepare' | 'dispatch-fetch' | 'dispatch-read' | 'dispatch-parse', errorText: string, forceConsoleMessage?: boolean) {
    if (SERVER_DEBUG_WIRE || forceConsoleMessage || true)
      console.error(`[POST] /api/llms/stream: ${this.prettyDialect}: ${errorId}: ${errorText}`);
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
