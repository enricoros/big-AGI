/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // defaults to TRUE, unless API Keys are set at build time; this flag is used by the UI
    REQUIRE_USER_API_KEYS: !process.env.OPENAI_API_KEY,
  },
};

module.exports = nextConfig;
