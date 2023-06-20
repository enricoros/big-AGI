/**
 * Returns 'true' if the application is been executed as a 'pwa' (e.g. installed, stand-alone)
 */
export const isPwa = (): boolean => {
  if (typeof window !== 'undefined')
    return window.matchMedia('(display-mode: standalone)').matches;
  return false;
};