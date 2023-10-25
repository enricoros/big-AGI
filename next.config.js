/** @type {import('next').NextConfig} */
let nextConfig = {
  reactStrictMode: true,
  env: {
    HAS_SERVER_DB_PRISMA: !!process.env.POSTGRES_PRISMA_URL && !!process.env.POSTGRES_URL_NON_POOLING,
    HAS_SERVER_KEYS_GOOGLE_CSE: !!process.env.GOOGLE_CLOUD_API_KEY && !!process.env.GOOGLE_CSE_ID,
    HAS_SERVER_KEY_ANTHROPIC: !!process.env.ANTHROPIC_API_KEY,
    HAS_SERVER_KEY_AZURE_OPENAI: !!process.env.AZURE_OPENAI_API_KEY && !!process.env.AZURE_OPENAI_API_ENDPOINT,
    HAS_SERVER_KEY_ELEVENLABS: !!process.env.ELEVENLABS_API_KEY,
    HAS_SERVER_KEY_OPENAI: !!process.env.OPENAI_API_KEY,
    HAS_SERVER_KEY_OPENROUTER: !!process.env.OPENROUTER_API_KEY,
    HAS_SERVER_KEY_PRODIA: !!process.env.PRODIA_API_KEY,
  },
  webpack: (config, _options) => {
    // @mui/joy: anything material gets redirected to Joy
    config.resolve.alias['@mui/material'] = '@mui/joy';

    // @dqbd/tiktoken: enable asynchronous WebAssembly
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};

// conditionally enable the nextjs bundle analyzer
if (process.env.ANALYZE_BUNDLE)
  nextConfig = require('@next/bundle-analyzer')()(nextConfig);

module.exports = nextConfig;
