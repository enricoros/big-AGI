type PerfOperationStats = {
  count: number;
  lastMs: number;
  maxMs: number;
  minMs: number;
  totalMs: number;
};

export type PerfOperationSnapshot = PerfOperationStats & {
  avgMs: number;
  name: string;
};

export type PerfRegistrySnapshot = {
  enabled: boolean;
  generatedAt: string;
  operations: PerfOperationSnapshot[];
};

type PerfWindowController = {
  disable: () => void;
  enable: () => void;
  enabled: () => boolean;
  print: (limit?: number) => PerfRegistrySnapshot;
  reset: () => void;
  snapshot: () => PerfRegistrySnapshot;
};

declare global {
  interface Window {
    __BIG_AGI_PERF__?: PerfWindowController;
  }
}

export function createPerfStatsRegistry(isEnabled: () => boolean, now: () => number) {
  const operations = new Map<string, PerfOperationStats>();

  const recordDuration = (name: string, durationMs: number) => {
    const duration = Math.max(0, Number(durationMs.toFixed(3)));
    const previous = operations.get(name);
    if (!previous) {
      operations.set(name, {
        count: 1,
        lastMs: duration,
        maxMs: duration,
        minMs: duration,
        totalMs: duration,
      });
      return;
    }

    previous.count += 1;
    previous.lastMs = duration;
    previous.totalMs = Number((previous.totalMs + duration).toFixed(3));
    previous.maxMs = Math.max(previous.maxMs, duration);
    previous.minMs = Math.min(previous.minMs, duration);
  };

  const measureSync = <T>(name: string, fn: () => T): T => {
    if (!isEnabled())
      return fn();

    const start = now();
    try {
      return fn();
    } finally {
      recordDuration(name, now() - start);
    }
  };

  const snapshot = (): PerfRegistrySnapshot => ({
    enabled: isEnabled(),
    generatedAt: new Date().toISOString(),
    operations: [...operations.entries()]
      .map(([name, stats]) => ({
        name,
        ...stats,
        avgMs: Number((stats.totalMs / stats.count).toFixed(3)),
      }))
      .sort((a, b) => b.totalMs - a.totalMs),
  });

  const reset = () => {
    operations.clear();
  };

  return {
    measureSync,
    recordDuration,
    reset,
    snapshot,
  };
}

const perfFlagKey = 'big-agi:perf';

let browserPerfEnabledCache: boolean | null = null;

function readBrowserPerfEnabled(): boolean {
  if (typeof window === 'undefined')
    return false;

  if (browserPerfEnabledCache !== null)
    return browserPerfEnabledCache;

  try {
    const queryEnabled = new URLSearchParams(window.location.search).get('perf') === '1';
    const persistedEnabled = window.localStorage.getItem(perfFlagKey) === '1';
    browserPerfEnabledCache = queryEnabled || persistedEnabled;
    return browserPerfEnabledCache;
  } catch {
    browserPerfEnabledCache = false;
    return false;
  }
}

function writeBrowserPerfEnabled(enabled: boolean): void {
  browserPerfEnabledCache = enabled;
  if (typeof window === 'undefined')
    return;

  try {
    window.localStorage.setItem(perfFlagKey, enabled ? '1' : '0');
  } catch {
    // ignore storage failures
  }
}

const browserPerfRegistry = createPerfStatsRegistry(
  () => readBrowserPerfEnabled(),
  () => (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now(),
);

export function createWindowPerfController(params: {
  getEnabled: () => boolean;
  setEnabled: (enabled: boolean) => void;
  registry: ReturnType<typeof createPerfStatsRegistry>;
}): PerfWindowController {
  const snapshot = () => params.registry.snapshot();
  return {
    enable: () => params.setEnabled(true),
    disable: () => params.setEnabled(false),
    enabled: () => params.getEnabled(),
    reset: () => params.registry.reset(),
    snapshot,
    print: (limit = 20) => {
      const perfSnapshot = snapshot();
      const topOperations = perfSnapshot.operations.slice(0, limit).map(operation => ({
        name: operation.name,
        count: operation.count,
        totalMs: operation.totalMs,
        avgMs: operation.avgMs,
        maxMs: operation.maxMs,
        minMs: operation.minMs,
        lastMs: operation.lastMs,
      }));
      console.table(topOperations);
      return perfSnapshot;
    },
  };
}

export function installBrowserPerfController(): void {
  if (typeof window === 'undefined')
    return;

  if (window.__BIG_AGI_PERF__)
    return;

  window.__BIG_AGI_PERF__ = createWindowPerfController({
    getEnabled: () => readBrowserPerfEnabled(),
    setEnabled: (enabled) => writeBrowserPerfEnabled(enabled),
    registry: browserPerfRegistry,
  });
}

export function isBrowserPerfEnabled(): boolean {
  return readBrowserPerfEnabled();
}

export function perfMeasureSync<T>(name: string, fn: () => T): T {
  return browserPerfRegistry.measureSync(name, fn);
}

export function perfRecordReactRender(id: string, phase: 'mount' | 'update' | 'nested-update', actualDuration: number): void {
  if (!readBrowserPerfEnabled())
    return;
  browserPerfRegistry.recordDuration(`react:${id}:${phase}`, actualDuration);
}
