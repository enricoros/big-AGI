import { AixClientDebugger, AixFrameId, useAixClientDebuggerStore } from './memstore-aix-client-debugger';


export function aixClientDebugger_init(contextInfo: AixClientDebugger.Context): AixFrameId {
  return useAixClientDebuggerStore.getState().createFrame(contextInfo);
}

export function aixClientDebugger_setRequest(
  frameId: AixFrameId,
  request: { url: string, headers: string, body: string, bodySize: number },
): void {
  useAixClientDebuggerStore.getState().setRequest(frameId, {
    url: request.url,
    headers: request.headers,
    body: request.body,
    bodySize: request.bodySize,
  });
}

export function aixClientDebugger_setProfilerMeasurements(
  frameId: AixFrameId,
  measurements: AixClientDebugger.Measurements,
): void {
  useAixClientDebuggerStore.getState().setProfilerMeasurements(frameId, measurements);
}

export function aixClientDebugger_recordParticleReceived(frameId: AixFrameId, particleContent: Record<string, any>, isAborted = false): void {
  useAixClientDebuggerStore.getState().addParticle(frameId, {
    timestamp: Date.now(),
    content: particleContent,
    ...(isAborted && { isAborted }),
  });
}

export function aixClientDebugger_completeFrame(frameId: number): void {
  useAixClientDebuggerStore.getState().completeFrame(frameId);
}
