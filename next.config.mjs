// Non-default build types
const buildType =
  process.env.BIG_AGI_BUILD === 'standalone' ? 'standalone'
    : process.env.BIG_AGI_BUILD === 'static' ? 'export'
      : undefined;

buildType && console.log(`   🧠 big-AGI: building for ${buildType}...\n`);

/** @type {import('next').NextConfig} */
let nextConfig = {
  reactStrictMode: true,

  // [exports] https://nextjs.org/docs/advanced-features/static-html-export
  ...buildType && {
    output: buildType,
    distDir: 'dist',

    // disable image optimization for exports
    images: { unoptimized: true },

    // Optional: Change links `/me` -> `/me/` and emit `/me.html` -> `/me/index.html`
    // trailingSlash: true,
  },

  // [puppeteer] https://github.com/puppeteer/puppeteer/issues/11052
  experimental: {
    serverComponentsExternalPackages: ['puppeteer-core'],
  },

  webpack: (config, _options) => {
    // @mui/joy: anything material gets redirected to Joy
    config.resolve.alias['@mui/material'] = '@mui/joy';

    // @dqbd/tiktoken: enable asynchronous WebAssembly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    // prevent too many small chunks (40kb min) on 'client' packs (not 'server' or 'edge-server')
    if (typeof config.optimization.splitChunks === 'object' && config.optimization.splitChunks.minSize)
      config.optimization.splitChunks.minSize = 40 * 1024;

    return config;
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

// Validate environment variables, if set at build time. Will be actually read and used at runtime.
// This is the reason both this file and the servr/env.mjs files have this extension.
await import('./src/server/env.mjs');

// conditionally enable the nextjs bundle analyzer
if (process.env.ANALYZE_BUNDLE) {
  const { default: withBundleAnalyzer } = await import('@next/bundle-analyzer');
  nextConfig = withBundleAnalyzer({ openAnalyzer: true })(nextConfig);
}

export default nextConfig;