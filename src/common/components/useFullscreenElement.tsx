/**
 * Copyright (c) 2024 Enrico Ros
 *
 * Hook to manage fullscreen mode for a given element.
 */

import * as React from 'react';

export function useFullscreenElement<T extends HTMLElement>(elementRef: React.RefObject<T>) {

  // state
  const [isFullscreen, setIsFullscreen] = React.useState<boolean>(false);

  // methods
  const enterFullscreen = React.useCallback(async () => {
    if (!elementRef.current) return;
    try {
      await elementRef.current.requestFullscreen();
    } catch (error) {
      console.error('Error attempting to enable fullscreen mode:', error);
    }
  }, [elementRef]);

  const exitFullscreen = React.useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        console.error('Error attempting to exit fullscreen mode:', error);
      }
    }
  }, []);

  // monitor fullscreen changes
  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === elementRef.current);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [elementRef]);

  return { isFullscreen, enterFullscreen, exitFullscreen };
}
