import * as React from 'react';


export function useDontBlurTextarea() {
  return React.useCallback((event: React.MouseEvent) => {
    const isTextAreaFocused = document.activeElement?.tagName === 'TEXTAREA';
    // If a textarea is focused, prevent the default blur behavior
    if (isTextAreaFocused)
      event.preventDefault();
  }, []);
}