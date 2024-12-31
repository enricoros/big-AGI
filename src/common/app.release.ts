/**
 * Copyright (c) 2024 Enrico Ros
 *
 * This file is include by both the frontend and backend, however depending on the time
 * of the build, the values may be different.
 */


/**
 * We centralize here the version information of the app, to have a uniform configuration surface.
 */
export const Release = {
  // CHANGE ME - this is the tenant ID, 'open' reserved for GitHub
  TenantId: 'open',

  App: {
    pl: 'v2-dev',
    versionCode: '2.0.0-ea1',       // 1.91.0 sequentially...
    versionName: 'Big-AGI V2 EA1',
  },

  // Future compatibility
  Features: {
    // ...
    BACKEND_REVALIDATE_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours
  },

  // this is here to trigger revalidation of data, e.g. models refresh
  Monotonics: {
    Aix: 5,
    NewsVersion: 191,
  },

  /**
   * We force explicit declaration of the caller.
   */
  buildInfo: (_type: 'frontend' | 'backend') => ({
    // **NOTE**: do not change var names here, as they're matched from this point forward
    //           between the frontend and backend to ensure runtime consistency.
    gitSha: process.env.NEXT_PUBLIC_BUILD_HASH,
    pkgVersion: process.env.NEXT_PUBLIC_BUILD_PKGVER,
    timestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP,
  }),

  IsNodeDevBuild: process.env.NODE_ENV === 'development',

} as const;
