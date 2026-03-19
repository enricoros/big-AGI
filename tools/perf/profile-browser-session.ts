import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import puppeteer, { type Browser, type CDPSession, type Page } from 'puppeteer-core';


type PerfSeedId = 'chat-long' | 'consensus-long';

type BrowserPerfOperation = {
  name: string;
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
  minMs: number;
  lastMs: number;
};

type BrowserPerfSnapshot = {
  enabled: boolean;
  generatedAt: string;
  operations: BrowserPerfOperation[];
};

type BrowserProfileStage = {
  label: string;
  domNodes: number;
  jsHeapBytes: number | null;
  perfSnapshot: BrowserPerfSnapshot;
  topOperations: BrowserPerfOperation[];
  cdpMetrics: Record<string, number>;
  navigation: Record<string, unknown> | null;
  userAgentMemory: unknown;
};

const PERF_SEEDS: PerfSeedId[] = ['chat-long', 'consensus-long'];
const DEFAULT_BASE_URL = process.env.PERF_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_CHROME_PATH = process.env.PERF_CHROME_PATH || '/usr/bin/google-chrome';
const PERF_ARTIFACTS_DIR = join(process.cwd(), 'artifacts', 'perf');

function ensureArtifactsDir() {
  mkdirSync(PERF_ARTIFACTS_DIR, { recursive: true });
}

function assertChromeExecutable() {
  if (!existsSync(DEFAULT_CHROME_PATH))
    throw new Error(`Chrome executable not found at ${DEFAULT_CHROME_PATH}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPerfController(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof window !== 'undefined'
      && !!window.__BIG_AGI_PERF__
      && window.__BIG_AGI_PERF__.enabled(),
    { timeout: 30_000 },
  );
}

async function resetPerfSnapshot(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__BIG_AGI_PERF__?.reset();
  });
}

async function readPerfStage(page: Page, cdpSession: CDPSession, label: string): Promise<BrowserProfileStage> {
  const metrics = await page.metrics();
  const perfSnapshot = await page.evaluate(() => window.__BIG_AGI_PERF__?.snapshot() ?? {
    enabled: false,
    generatedAt: new Date().toISOString(),
    operations: [],
  }) as BrowserPerfSnapshot;

  const navigation = await page.evaluate(() => {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (!entry)
      return null;
    return {
      domComplete: entry.domComplete,
      domContentLoadedEventEnd: entry.domContentLoadedEventEnd,
      loadEventEnd: entry.loadEventEnd,
      responseEnd: entry.responseEnd,
      startTime: entry.startTime,
      transferSize: entry.transferSize,
      type: entry.type,
    };
  });

  const userAgentMemory = await page.evaluate(async () => {
    const perf = performance as Performance & {
      measureUserAgentSpecificMemory?: () => Promise<unknown>;
    };
    if (typeof perf.measureUserAgentSpecificMemory !== 'function')
      return null;
    try {
      return await perf.measureUserAgentSpecificMemory();
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });

  const cdpMetricsResponse = await cdpSession.send('Performance.getMetrics');
  const cdpMetrics = Object.fromEntries(
    (cdpMetricsResponse.metrics ?? []).map((metric: { name: string; value: number }) => [metric.name, metric.value]),
  );

  return {
    label,
    domNodes: metrics.Nodes ?? 0,
    jsHeapBytes: typeof metrics.JSHeapUsedSize === 'number' ? metrics.JSHeapUsedSize : null,
    perfSnapshot,
    topOperations: perfSnapshot.operations.slice(0, 15),
    cdpMetrics,
    navigation,
    userAgentMemory,
  };
}

async function exerciseSeed(page: Page, seedId: PerfSeedId): Promise<void> {
  if (seedId === 'chat-long') {
    await page.mouse.wheel({ deltaY: 1600 });
    await sleep(300);
    await page.mouse.wheel({ deltaY: -900 });
    await sleep(300);
    return;
  }

  await page.evaluate(() => {
    let expandClicks = 0;
    let detailClicks = 0;

    for (const element of Array.from(document.querySelectorAll('button'))) {
      const text = element.textContent?.trim();
      if (text === 'Expand' && expandClicks < 2) {
        (element as HTMLButtonElement).click();
        expandClicks++;
        continue;
      }
      if (text === 'Show details' && detailClicks < 4) {
        (element as HTMLButtonElement).click();
        detailClicks++;
      }
      if (expandClicks >= 2 && detailClicks >= 4)
        break;
    }
  });
  await sleep(800);
}

async function profileSeed(browser: Browser, seedId: PerfSeedId) {
  const page = await browser.newPage();
  const cdpSession = await page.target().createCDPSession();
  await cdpSession.send('Performance.enable');
  await page.setViewport({ width: 1440, height: 1600, deviceScaleFactor: 1 });

  const tracePath = join(PERF_ARTIFACTS_DIR, `browser-session-${seedId}.trace.json`);
  await page.tracing.start({
    path: tracePath,
    screenshots: false,
  });

  const url = `${DEFAULT_BASE_URL}/?perf=1&perfSeed=${seedId}`;
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });
  await waitForPerfController(page);
  await sleep(1_500);

  const initialStage = await readPerfStage(page, cdpSession, 'post-load');
  await resetPerfSnapshot(page);
  await sleep(200);
  await exerciseSeed(page, seedId);
  await sleep(1_000);
  const exercisedStage = await readPerfStage(page, cdpSession, 'post-exercise');

  const screenshotPath = join(PERF_ARTIFACTS_DIR, `browser-session-${seedId}.jpeg`);
  await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 85, fullPage: true });

  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'networkidle0', timeout: 60_000 });
  await sleep(500);
  await page.tracing.stop();
  await page.close();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: DEFAULT_BASE_URL,
    chromePath: DEFAULT_CHROME_PATH,
    seedId,
    stages: [initialStage, exercisedStage],
  };

  const reportPath = join(PERF_ARTIFACTS_DIR, `browser-session-${seedId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return report;
}

async function main() {
  ensureArtifactsDir();
  assertChromeExecutable();

  const browser = await puppeteer.launch({
    executablePath: DEFAULT_CHROME_PATH,
    headless: true,
    args: [
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-features=Translate,BackForwardCache',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });

  try {
    const reports = [];
    for (const seedId of PERF_SEEDS)
      reports.push(await profileSeed(browser, seedId));

    const summary = {
      generatedAt: new Date().toISOString(),
      baseUrl: DEFAULT_BASE_URL,
      reports: reports.map(report => ({
        seedId: report.seedId,
        postLoadTopOperations: report.stages[0]?.topOperations.slice(0, 5) ?? [],
        postExerciseTopOperations: report.stages[1]?.topOperations.slice(0, 5) ?? [],
        postLoadDomCompleteMs: report.stages[0]?.navigation && typeof report.stages[0].navigation.domComplete === 'number'
          ? report.stages[0].navigation.domComplete
          : null,
        postExerciseDomNodes: report.stages[1]?.domNodes ?? null,
        postExerciseHeapBytes: report.stages[1]?.jsHeapBytes ?? null,
      })),
    };
    const summaryPath = join(PERF_ARTIFACTS_DIR, 'browser-session-summary.json');
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`Wrote ${summaryPath}`);
    console.table(summary.reports.map(report => ({
      seed: report.seedId,
      domCompleteMs: report.postLoadDomCompleteMs ? Number(report.postLoadDomCompleteMs.toFixed(1)) : null,
      domNodes: report.postExerciseDomNodes,
      heapMB: report.postExerciseHeapBytes ? Number((report.postExerciseHeapBytes / (1024 * 1024)).toFixed(2)) : null,
      topOp: report.postExerciseTopOperations[0]?.name ?? report.postLoadTopOperations[0]?.name ?? '(none)',
      topOpMs: report.postExerciseTopOperations[0]?.totalMs ?? report.postLoadTopOperations[0]?.totalMs ?? 0,
    })));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
