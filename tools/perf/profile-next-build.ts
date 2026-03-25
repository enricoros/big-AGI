import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';


type AssetEntry = {
  file: string;
  bytes: number;
};

function runBuild() {
  const result = spawnSync('npm', ['run', 'build'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      ANALYZE_BUNDLE: '1',
      ANALYZE_BUNDLE_OPEN: '0',
    },
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`Build failed with exit code ${result.status ?? 'unknown'}`);
  }

  return result.stdout;
}

function getJsonSize(filePath: string): number {
  return Buffer.byteLength(readFileSync(filePath));
}

function getTopAssets(distPath: string): AssetEntry[] {
  const buildManifest = JSON.parse(readFileSync(join(distPath, 'build-manifest.json'), 'utf8')) as {
    lowPriorityFiles?: string[];
    pages: Record<string, string[]>;
  };

  const allFiles = new Set<string>();
  for (const files of Object.values(buildManifest.pages))
    for (const file of files)
      allFiles.add(file);
  for (const file of buildManifest.lowPriorityFiles ?? [])
    allFiles.add(file);

  return [...allFiles]
    .filter(file => file.endsWith('.js') || file.endsWith('.css'))
    .map(file => ({
      file,
      bytes: getJsonSize(join(distPath, file.replace(/^\//, ''))),
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 25);
}

function main() {
  const buildStdout = runBuild();
  const distPath = join(process.cwd(), '.next');
  const reportDir = join(process.cwd(), 'artifacts', 'perf');
  mkdirSync(reportDir, { recursive: true });

  const topAssets = getTopAssets(distPath);
  const report = {
    generatedAt: new Date().toISOString(),
    topAssets,
    buildStdout,
  };

  const reportPath = join(reportDir, 'next-build-profile.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`Wrote ${reportPath}`);
  console.table(topAssets.slice(0, 10).map(asset => ({
    file: asset.file,
    kb: Number((asset.bytes / 1024).toFixed(1)),
  })));
}

main();
