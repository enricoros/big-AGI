const BuildOptions = {
  // Future: Electron/Frontend-only builds
  exportFrontend: !!process.env.EXPORT_FRONTEND,
};

/** @type {import('next').NextConfig} */
let nextConfig = {
  reactStrictMode: true,

  // [exporting] https://nextjs.org/docs/advanced-features/static-html-export
  ...BuildOptions.exportFrontend && {
    // Export the frontend to ./dist
    output: 'export',
    distDir: 'out',

    // Disable Image optimization
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

    // [exporting] prevent too many small files (50kb)
    if (BuildOptions.exportFrontend)
      config.optimization.splitChunks.minSize = 50 * 1024;

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