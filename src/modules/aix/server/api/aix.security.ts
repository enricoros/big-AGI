/**
 * Security - only allow certain operations in development builds (i.e. not in any production builds by default):
 *  1. dispatch Headers: hide sensitive data such as keys
 *  2. Performance profiling: visible in the AIX debugger when requested on development builds
 *  3. 'DEV_URL: ...' in error messages to show the problematic upstream URL
 *  4. onComment on SSE streams
 */
export const AIX_SECURITY_ONLY_IN_DEV_BUILDS = process.env.NODE_ENV === 'development';
