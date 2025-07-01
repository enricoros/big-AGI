// Types

type PerformanceMeasurements = PerformanceMeasurement[];

interface PerformanceMeasurement extends Record<string, number | string> {
  operation: string;
  totalMs: number;
  percent: number;
  count: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}


/**
 * Lightweight 'performance'-like API for Edge runtimes.
 *
 * Note (Enrico): on Edge runtimes the Date.now() function could be a bit coarse,
 * to prevent timing attacks. Still should be indicative enough for statistical
 * profiling in our use cases.
 */
class _EdgePerformanceFallback {

  private marks = new Map<string, number>();
  private measures = new Map<string, { duration: number }[]>();

  mark(name: string): void {
    this.marks.set(name, Date.now());
  }

  measure(name: string, startMark: string, endMark: string): void {
    const startTime = this.marks.get(startMark);
    const endTime = this.marks.get(endMark);

    if (startTime && endTime) {
      if (!this.measures.has(name))
        this.measures.set(name, []);
      this.measures.get(name)?.push({ duration: endTime - startTime });
    }
  }

  clearMarks(name: string): void {
    if (name)
      this.marks.delete(name);
    else
      this.marks.clear();
  }

  clearMeasures(name: string): void {
    if (name)
      this.measures.delete(name);
    else
      this.measures.clear();
  }

  getEntriesByName(name: string, type: string): Array<{ duration: number }> {
    if (type === 'measure')
      return this.measures.get(name) || [];
    return [];
  }
}


/**
 * Retuns the performance API, or a lightweight fallback when it's not available.
 */
function _getPerformanceAPI(): typeof performance | _EdgePerformanceFallback {

  // FIXME: we are forcing the fallback for now, as the performance API would conflict with Beam
  //        as 'marks' are global and would conflict between chats.
  // if (typeof performance !== 'undefined' && typeof performance.mark === 'function' && typeof performance.measure === 'function')
  //   return performance;

  return new _EdgePerformanceFallback();
}


export function performanceProfilerLog(label: string, measurements?: PerformanceMeasurements): void {
  console.log(`\n---- ${label} ----`);
  console.log('Operation        | Total ms   | % of Total | Count | Avg ms   | Min ms   | Max ms   ');
  console.log('-----------------|------------|------------|-------|----------|----------|----------');
  if (measurements?.length) {
    for (const result of measurements) {
      // Format the percentage with one decimal place
      const percentageFormatted = result.percent.toFixed(1) + '%';
      console.log(
        `${result.operation.padEnd(16)} | ` +
        `${String(result.totalMs).padEnd(10)} | ` +
        `${percentageFormatted.padEnd(10)} | ` +
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
 * High-precision performance profiler - utility class. Compatible with Edge runtimes.
 */
export class PerformanceProfiler {

  private readonly perf = _getPerformanceAPI();
  private readonly measurements = new Map<string, number>();

  /** Start measuring an operation */
  measureStart(name: string): void {
    this.perf.mark(`${name}:start`);
  }

  /** End measuring an operation */
  measureEnd(name: string): void {
    this.perf.mark(`${name}:end`);
    this.perf.measure(name, `${name}:start`, `${name}:end`);
    this.measurements.set(name, (this.measurements.get(name) || 0) + 1);
  }

  /** Call this between sessions, as the runtime will otherwise keep accumulating */
  clearMeasurements(): void {
    for (const name of this.measurements.keys()) {
      this.perf.clearMarks(`${name}:start`);
      this.perf.clearMarks(`${name}:end`);
      this.perf.clearMeasures(name);
    }
    this.measurements.clear();
  }

  /** Get performance results, JSON-friendly */
  getResultsData(): PerformanceMeasurements {
    const results: PerformanceMeasurements = [];
    let grandTotalMs = 0;

    for (const name of this.measurements.keys()) {
      const entries = this.perf.getEntriesByName(name, 'measure');
      const count = entries.length;
      const totalMs = entries.reduce((sum, entry) => sum + entry.duration, 0);
      grandTotalMs += totalMs;
      const avgMs = totalMs / count;
      const minMs = Math.min(...entries.map(e => e.duration));
      const maxMs = Math.max(...entries.map(e => e.duration));

      results.push({
        operation: name,
        totalMs: Number(totalMs.toFixed(2)),
        percent: 0,
        count: count,
        avgMs: Number(avgMs.toFixed(2)),
        minMs: Number(minMs.toFixed(2)),
        maxMs: Number(maxMs.toFixed(2)),
      });
    }

    for (let result of results)
      result.percent = grandTotalMs > 0 ? Number((result.totalMs / grandTotalMs * 100).toFixed(1)) : 0;

    return results.sort((a, b) => b.totalMs - a.totalMs);
  }

}