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
  // CHANGE ME - this is the tenant ID, 'dev' reserved for development only, 'open' reserved for GitHub
  TenantSlug: 'open',

  App: {
    versionCode: '2.0.0-open-rc2',       // 1.92.0 sequentially...
    versionName: 'Big-AGI 2',
    releaseNotes: '',
  },

  // Future compatibility
  Features: {
    // ...
    BACKEND_REVALIDATE_INTERVAL: 6 * 60 * 60 * 1000, // 6 hours
    // DISABLE_PRECISE_TOKENIZER: false, // future optimization: disables the correct tokenizer fully or over a certain input size (e.g. 1k)
    LIGHTER_ANIMATIONS: false, // optimization: disables some animations for performance
  },

  // this is here to trigger revalidation of data, e.g. models refresh
  Monotonics: {
    Aix: 19,
    NewsVersion: 192,
  },

  // Frontend: pretty features
  TechLevels: {
    AIX: '1.1', Apply: '0.8', Beam: '2.0', LFS: '0.5', /*Precog: '0.1',*/ React: '1.5',
  },
  AiFunctions: [
    // from `ContextChatGenerate_schema`
    'auto-chart', 'auto-diagram', 'auto-ui',
    'chat-call', 'chat-compress', 'chat-persona', 'chat-summary', 'chat-title',
    'create-attach-prompts', 'create-image-prompt', 'create-persona',
    'diff-whole',
    'fixup',
    'reason-beam', 'reason-merge', 'reason-react',
  ],

  /**
   * We force explicit declaration of the caller.
   */
  buildInfo: (_type: 'frontend' | 'backend') => ({
    // **NOTE**: do not change var names here, as they're matched from this point forward
    //           between the frontend and backend to ensure runtime consistency.
    deploymentType: process.env.NEXT_PUBLIC_DEPLOYMENT_TYPE,
    pkgVersion: process.env.NEXT_PUBLIC_BUILD_PKGVER,
    gitSha: process.env.NEXT_PUBLIC_BUILD_HASH,
    timestamp: process.env.NEXT_PUBLIC_BUILD_TIMESTAMP,
  }),

  IsNodeDevBuild: process.env.NODE_ENV === 'development',

} as const;
