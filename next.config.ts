import type { NextConfig } from 'next';
import type { WebpackConfigContext } from 'next/dist/server/config-shared';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';


// Log only on the first pass (next build evaluates this module twice: build() setup, then the webpack step)
process.env.__AGI_CONFIG_PASS = String(Number(process.env.__AGI_CONFIG_PASS || '0') + 1);
const log = process.env.__AGI_CONFIG_PASS === '1' ? (...args: any[]) => console.log(args.length ? ' 🧠 ' : '', ...args) : () => { };


// Require build hash: from CI env, git CLI, or .git metadata (let through in docker builds)
let buildHash = process.env.NEXT_PUBLIC_BUILD_HASH || process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA; // Docker or custom, GitHub Actions, Vercel
if (!buildHash) try { buildHash = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* no git binary or no repository - .git metadata read below */ }
if (!buildHash) try { // git-less checkout read, e.g. `docker build`: the context admits only .git/{HEAD,refs,packed-refs} - see .dockerignore
  const readGit = (path: string) => readFileSync(new URL(`./.git/${path}`, import.meta.url), 'utf8').trim();
  const head = readGit('HEAD'), ref = head.startsWith('ref: ') ? head.slice(5) : null; // detached HEAD carries the raw sha
  buildHash = !ref ? head : (() => { try { return readGit(ref); /* loose ref */ } catch { return readGit('packed-refs').split('\n').find((line) => line.endsWith(' ' + ref))?.split(' ')[0]; /* packed ref */ } })();
} catch { /* sha-less source (e.g. archive download) - throw below */ }
if (!buildHash) throw new Error('Big-AGI build: missing build identity. Build from a git checkout, or pass NEXT_PUBLIC_BUILD_HASH (docker: --build-arg NEXT_PUBLIC_BUILD_HASH=..sha..).');

// The following are used by/available to Release.buildInfo(...)
process.env.NEXT_PUBLIC_BUILD_HASH = buildHash.slice(0, 10);
process.env.NEXT_PUBLIC_BUILD_PKGVER = JSON.parse('' + readFileSync(new URL('./package.json', import.meta.url))).version;
process.env.NEXT_PUBLIC_BUILD_TIMESTAMP = new Date().toISOString();
process.env.NEXT_PUBLIC_DEPLOYMENT_TYPE ||= (process.env.VERCEL_ENV ? `vercel-${process.env.VERCEL_ENV}` : 'local'); // Docker or custom, Vercel
log(`\x1b[1mBig-AGI\x1b[0m v${process.env.NEXT_PUBLIC_BUILD_PKGVER} (\x1b[2m@\x1b[0m${process.env.NEXT_PUBLIC_BUILD_HASH}${process.env.VERCEL_ENV ? `, \x1b[2mV:\x1b[0m${process.env.VERCEL_ENV}` : ''}, \x1b[2mN:\x1b[0m${process.env.NODE_ENV})`);


// Handle non-default build types
const buildType =
  process.env.BIG_AGI_BUILD === 'standalone' ? 'standalone' as const
    : process.env.BIG_AGI_BUILD === 'static' ? 'export' as const
      : undefined;
buildType && log(`🛠 building for ${buildType}...\n`);


/** @type {import('next').NextConfig} */
let nextConfig: NextConfig = {
  reactStrictMode: !process.env.NO_STRICT_MODE, // default: enabled

  // build-time lint: default ON (a build is the last gate); NO_LINT_BUILD=1 skips the ~15s
  // typed pass when CI already ran `npm run lint` as its own step
  eslint: { ignoreDuringBuilds: !!process.env.NO_LINT_BUILD },

  // [exports] https://nextjs.org/docs/advanced-features/static-html-export
  ...(buildType && {
    output: buildType,
    distDir: 'dist',

    // disable image optimization for exports
    images: { unoptimized: true },

    // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
    // trailingSlash: true,
  }),

  // Allow running builds without racing over .next/ - if set takes precedence over the 'dist' above
  // However note this will cause issues with "include" in tsconfig.json, which assumes 'dist'
  ...(process.env.AGI_DIST_DIR && { distDir: process.env.AGI_DIST_DIR }),

  // [puppeteer] https://github.com/puppeteer/puppeteer/issues/11052
  // NOTE: we may not be needing this anymore, as we use '@cloudflare/puppeteer'
  serverExternalPackages: ['puppeteer-core'],

  webpack: (config: any, { isServer, webpack /*, dev, nextRuntime*/ }: WebpackConfigContext) => {
    // @mui/joy: anything material gets redirected to Joy
    config.resolve.alias['@mui/material'] = '@mui/joy';

    // @dqbd/tiktoken: enable asynchronous WebAssembly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // client-side bundling
    if (!isServer) {
      /**
       * AIX client-side
       * We replace certain server-only modules with client-side mocks, to reuse the exact same imports
       * while avoiding importing server-only code which would break the build or break at runtime.
       */
      const serverToClientMocks: ReadonlyArray<[RegExp, string]> = [
        [/\/posthog\.server/, '/posthog.client-mock'],
        [/\/env\.server/, '/env.client-mock'],
      ];
      config.plugins = [
        ...config.plugins,
        ...serverToClientMocks.map(([pattern, replacement]) =>
          new webpack.NormalModuleReplacementPlugin(pattern, (resource: any) => {
            // log('- WEBPACK CLIENT REPLACEMENT:', resource.request, '->', resource.request.replace(pattern, replacement));
            resource.request = resource.request.replace(pattern, replacement);
          }),
        ),
      ];

      // cosmetic: fix warnings for (absent!) top-level awaits in the browser (https://github.com/vercel/next.js/issues/64792)
      config.output.environment = { ...config.output.environment, asyncFunction: true };
    }

    // prevent too many small chunks (40kb min) on 'client' packs (not 'server' or 'edge-server')
    // noinspection JSUnresolvedReference
    if (typeof config.optimization.splitChunks === 'object' && config.optimization.splitChunks.minSize) {
      // noinspection JSUnresolvedReference
      config.optimization.splitChunks.minSize = 40 * 1024;
    }

    return config;
  },

  // Optional Analytics > PostHog
  skipTrailingSlashRedirect: true, // required to support PostHog trailing slash API requests
  async rewrites() {
    return [
      { source: '/a/ph/static/:path*', destination: 'https://us-assets.i.posthog.com/static/:path*' },
      { source: '/a/ph/array/:path*', destination: 'https://us-assets.i.posthog.com/array/:path*' },
      { source: '/a/ph/:path*', destination: 'https://us.i.posthog.com/:path*' },
      // Dev tools hub: unified index at /dev (static page in /public/dev/index.html)
      { source: '/dev', destination: '/dev/index.html' },
      // Inspect: standalone static dev tools under /public/dev/inspect/*.html (clean URLs, no .html)
      // The (\w+) constraint excludes paths with a dot, so '/dev/inspect/storage.html' is still served directly.
      { source: '/dev/inspect/:tool(\\w+)', destination: '/dev/inspect/:tool.html' },
    ];
  },

  // Note: disabled to check whether the project becomes slower with this
  // modularizeImports: {
  //   '@mui/icons-material': {
  //     transform: '@mui/icons-material/{{member}}',
  //   },
  // },

  // Uncomment the following leave console messages in production
  // compiler: {
  //   removeConsole: false,
  // },
};


// Validate environment variables at build time, if required. Server env vars will be actually read and used at runtime (cloud/edge).
import { env as validateEnv } from '~/server/env.server';
void validateEnv; // Triggers env validation - throws if required vars are missing


// PostHog error reporting with source maps for production builds
import { withPostHogConfig } from '@posthog/nextjs-config';
if (process.env.POSTHOG_API_KEY && process.env.POSTHOG_ENV_ID) {
  log('- building with PostHog issue reporting...');
  nextConfig = withPostHogConfig(nextConfig, {
    personalApiKey: process.env.POSTHOG_API_KEY,
    envId: process.env.POSTHOG_ENV_ID,
    host: 'https://us.i.posthog.com', // backtrace upload host
    logLevel: 'error', // lowered, too noisy
    sourcemaps: {
      enabled: process.env.NODE_ENV === 'production',
      project: 'big-agi',
      version: process.env.NEXT_PUBLIC_BUILD_HASH,
      deleteAfterUpload: false, // false: leave them in the tree, which would also help debugging of open-source installs
    },
  });
}


// conditionally enable the nextjs bundle analyzer
import withBundleAnalyzer from '@next/bundle-analyzer';
if (process.env.ANALYZE_BUNDLE) {
  nextConfig = withBundleAnalyzer({ openAnalyzer: true })(nextConfig) as NextConfig;
}


log(); // blank line after the sync part of the config runs
export default nextConfig;