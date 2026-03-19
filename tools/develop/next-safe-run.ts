import { spawn } from 'node:child_process';
import { existsSync, readFileSync, renameSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

const REQUIRED_PAGES_MANIFEST_ROUTES = ['/_app', '/_document', '/_error'] as const;
const NEXT_MISSING_CHUNK_PATTERN = /Cannot find module '\.\/(\d+\.js)'/;

function getMissingServerChunksForBundle(projectRoot: string, bundleRelativePath: string): string[] {
  const bundlePath = join(projectRoot, '.next', 'server', bundleRelativePath);
  if (!existsSync(bundlePath))
    return [];

  let bundleSource = '';
  try {
    bundleSource = readFileSync(bundlePath, 'utf8');
  } catch {
    return [];
  }

  const referencedChunkIds = [...bundleSource.matchAll(/\bt\.X\(\s*0\s*,\s*\[([^\]]*)\]/g)]
    .flatMap(match => match[1]?.split(',') ?? [])
    .map(token => token.trim())
    .filter(token => /^\d+$/.test(token));

  return referencedChunkIds.filter(chunkId => !existsSync(join(projectRoot, '.next', 'server', 'chunks', `${chunkId}.js`)));
}

export function findMissingNextChunkError(logText: string): string | null {
  return logText.match(NEXT_MISSING_CHUNK_PATTERN)?.[1] ?? null;
}

export function inspectNextBuildState(projectRoot: string): { isBroken: boolean; reason?: string } {
  const nextDir = join(projectRoot, '.next');
  if (!existsSync(nextDir))
    return { isBroken: false };

  const buildManifestPath = join(nextDir, 'build-manifest.json');
  if (!existsSync(buildManifestPath))
    return { isBroken: true, reason: `Missing ${buildManifestPath}` };

  const webpackRuntimePath = join(nextDir, 'server', 'webpack-runtime.js');
  if (!existsSync(webpackRuntimePath))
    return { isBroken: true, reason: `Missing ${webpackRuntimePath}` };

  if (existsSync(join(projectRoot, 'pages'))) {
    const pagesManifestPath = join(nextDir, 'server', 'pages-manifest.json');
    if (!existsSync(pagesManifestPath))
      return { isBroken: true, reason: `Missing ${pagesManifestPath}` };

    let pagesManifest: Record<string, string>;
    try {
      pagesManifest = JSON.parse(readFileSync(pagesManifestPath, 'utf8'));
    } catch {
      return { isBroken: true, reason: `Invalid ${pagesManifestPath}` };
    }

    const missingCoreRoutes = REQUIRED_PAGES_MANIFEST_ROUTES.filter(route => !pagesManifest[route]);
    if (missingCoreRoutes.length)
      return { isBroken: true, reason: `${pagesManifestPath} is missing ${missingCoreRoutes.join(', ')}` };

    for (const route of REQUIRED_PAGES_MANIFEST_ROUTES) {
      const bundleRelativePath = pagesManifest[route];
      if (!bundleRelativePath)
        continue;
      const missingChunks = getMissingServerChunksForBundle(projectRoot, bundleRelativePath);
      if (missingChunks.length)
        return {
          isBroken: true,
          reason: `${bundleRelativePath} references missing server chunk(s): ${missingChunks.map(chunkId => `${chunkId}.js`).join(', ')}`,
        };
    }
  }

  return { isBroken: false };
}

function moveBrokenNextBuildAside(projectRoot: string, reason: string) {
  const nextDir = join(projectRoot, '.next');
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

  for (let attempt = 0; ; attempt++) {
    const suffix = attempt === 0 ? '' : `-${attempt}`;
    const backupDir = join(projectRoot, `.next.corrupt-${timestamp}${suffix}`);
    if (existsSync(backupDir))
      continue;

    renameSync(nextDir, backupDir);
    console.warn(`[next-safe-run] Moved broken .next to ${basename(backupDir)} (${reason})`);
    return;
  }
}

async function main() {
  const projectRoot = process.cwd();
  const nextCommand = process.argv[2];
  const nextArgs = process.argv.slice(3);

  if (!nextCommand) {
    console.error('Usage: next-safe-run <next-command> [...args]');
    process.exitCode = 1;
    return;
  }

  const buildState = inspectNextBuildState(projectRoot);
  if (buildState.isBroken)
    moveBrokenNextBuildAside(projectRoot, buildState.reason ?? 'corrupt build output');

  const nextBin = require.resolve('next/dist/bin/next');
  const shouldWatchForMissingChunks = nextCommand === 'dev';
  let restartAttempts = 0;

  while (true) {
    const child = spawn(process.execPath, [nextBin, nextCommand, ...nextArgs], {
      cwd: projectRoot,
      env: process.env,
      stdio: shouldWatchForMissingChunks ? ['inherit', 'pipe', 'pipe'] : 'inherit',
    });

    let restartReason: string | null = null;
    let bufferedOutput = '';

    if (shouldWatchForMissingChunks) {
      const inspectChunk = (chunk: string) => {
        bufferedOutput = `${bufferedOutput}${chunk}`.slice(-64_000);
        const missingChunk = findMissingNextChunkError(bufferedOutput);
        if (!restartReason && missingChunk) {
          restartReason = `Missing runtime server chunk ${missingChunk}`;
          child.kill('SIGTERM');
        }
      };

      child.stdout?.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        process.stdout.write(text);
        inspectChunk(text);
      });
      child.stderr?.on('data', (chunk: Buffer | string) => {
        const text = chunk.toString();
        process.stderr.write(text);
        inspectChunk(text);
      });
    }

    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });

    if (restartReason && restartAttempts < 2) {
      restartAttempts++;
      if (existsSync(join(projectRoot, '.next')))
        moveBrokenNextBuildAside(projectRoot, restartReason);
      console.warn(`[next-safe-run] Restarting Next dev after runtime chunk failure (${restartReason})`);
      continue;
    }

    if (exit.signal) {
      process.kill(process.pid, exit.signal);
      return;
    }

    process.exitCode = exit.code ?? 1;
    return;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  void main();
