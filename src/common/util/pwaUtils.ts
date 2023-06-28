/**
 * Returns 'true' if the application is been executed as a 'pwa' (e.g. installed, stand-alone)
 */
export const isPwa = (): boolean => {
  if (typeof window !== 'undefined')
    return window.matchMedia('(display-mode: standalone)').matches;
  return false;
};


/**
 * An immediate alternative to useMediaQuery, for cases where we can't use CSS and we don't need to listen to changes
 * NOTE: not very useful, as it's definitely not responsive
 */
/*export const isMediaMinWidth = (width: number): boolean => {
  if (typeof window !== 'undefined')
    return window.matchMedia(`(min-width: ${width}px)`).matches;
  return true;
};*/

export const isChromeOnDesktopWindows = (): boolean => {
  if (typeof window !== 'undefined') {
    const agent = window.navigator.userAgent;
    return agent.indexOf('Windows') > -1 && agent.indexOf('Chrome') > -1 && agent.indexOf('Mobile') === -1;
  }
  return false;
}