// Types

type PerformanceMeasurements = PerformanceMeasurement[];

interface PerformanceMeasurement extends Record<string, number | string> {
  operation: string;
  totalMs: number;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}


// Utility function to print a pretty table of performance measurements - useful on the server side (client would have console.table)

export function performanceProfilerLog(label: string, measurements?: PerformanceMeasurements): void {
  console.log(`\n---- ${label} ----`);
  console.log('Operation        | Total ms   | Count | Avg ms   | Min ms   | Max ms   ');
  console.log('-----------------|------------|-------|----------|----------|----------');
  if (measurements?.length) {
    for (const result of measurements) {
      console.log(
        `${result.operation.padEnd(16)} | ` +
        `${String(result.totalMs).padEnd(10)} | ` +
        `${String(result.count).padEnd(5)} | ` +
        `${String(result.avgMs).padEnd(8)} | ` +
        `${String(result.minMs).padEnd(8)} | ` +
        `${String(result.maxMs).padEnd(8)}`,
      );
    }
  }
  console.log('-'.repeat(label.length + 10));
}


/**
 * High-precision performance profiler - utility class
 */
export class PerformanceProfiler {

  private readonly measurements = new Map<string, number>();

  /** Start measuring an operation */
  measureStart(name: string): void {
    performance.mark(`${name}:start`);
  }

  /** End measuring an operation */
  measureEnd(name: string): void {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
    this.measurements.set(name, (this.measurements.get(name) || 0) + 1);
  }

  /** Call this between sessions, as the runtime will otherwise keep accumulating */
  clearMeasurements(): void {
    for (const name of this.measurements.keys()) {
      performance.clearMarks(`${name}:start`);
      performance.clearMarks(`${name}:end`);
      performance.clearMeasures(name);
    }
    this.measurements.clear();
  }

  /** Get performance results, JSON-friendly */
  getResultsData(): PerformanceMeasurements {
    return Array.from(this.measurements.keys()).map(name => {
      const entries = performance.getEntriesByName(name, 'measure');
      const count = entries.length;
      const totalMs = entries.reduce((sum, entry) => sum + entry.duration, 0);
      const avgMs = totalMs / count;
      const minMs = Math.min(...entries.map(e => e.duration));
      const maxMs = Math.max(...entries.map(e => e.duration));

      return {
        operation: name,
        totalMs: Number(totalMs.toFixed(2)),
        count: count,
        avgMs: Number(avgMs.toFixed(2)),
        minMs: Number(minMs.toFixed(2)),
        maxMs: Number(maxMs.toFixed(2)),
      };
    }).sort((a, b) => b.totalMs - a.totalMs);
  }

}