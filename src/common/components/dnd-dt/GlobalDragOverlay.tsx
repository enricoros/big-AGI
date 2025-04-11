import * as React from 'react';

import { Box } from '@mui/joy';

import { WindowFocusObserver } from '~/common/util/windowUtils';
import { animationOpacityFadeIn } from '~/common/util/animUtils';
import { themeZIndexDragOverlay } from '~/common/app.theme';

import { EXCLUDE_SELF_TYPE } from './useDragDropDataTransfer';
import { useGlobalDragStore } from './volstore-drag-global';


// configuration
const DEBUG_DND_GLOBAL_OVERLAY = false;
const TIMEOUT_DRAG_RESET = 15 * 1000; // avoids getting stuck in drag state


const _dragOverlaySx = {
  position: 'fixed',
  inset: 0,
  zIndex: themeZIndexDragOverlay,
  backgroundColor: 'rgba(var(--joy-palette-neutral-darkChannel) / 0.1)',
  animation: `${animationOpacityFadeIn} 0.5s ease-in-out`,
  pointerEvents: 'none', // let events pass through
} as const;


function _setDragState(active: boolean, data?: DataTransfer | null) {
  useGlobalDragStore.setState({
    isWindowDragActive: active,
    dragHasFiles: !data ? false : Array.from(data.items).some(item => item.kind === 'file'),
  });
}


export function GlobalDragOverlay() {

  const { isWindowDragActive } = useGlobalDragStore();

  React.useEffect(() => {

    // counter to stack dragenter/dragleave events
    let dragCounter = 0;

    // window blur event listener - on demand
    let unsubFromWindowBlur: undefined | (() => void);


    // safety procedure to get un-stuck on browser bad dispatches
    let lastTimeoutId: number | null = null;

    const clearTimerDeadline = () => {
      if (!lastTimeoutId) return;
      window.clearTimeout(lastTimeoutId);
      lastTimeoutId = null;
    };


    const handleDragClear = () => {
      dragCounter = 0;
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragClear');

      clearTimerDeadline();

      if (unsubFromWindowBlur) {
        unsubFromWindowBlur();
        unsubFromWindowBlur = undefined;
      }

      _setDragState(false);
    };

    const handleDragEnter = (e: DragEvent) => {
      dragCounter = dragCounter < 0 ? 1 : dragCounter + 1;
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragEnter', dragCounter, e.dataTransfer?.types);

      // Skip if this came from within our app
      if (e.dataTransfer?.types.includes(EXCLUDE_SELF_TYPE))
        return;

      // move forward the emergency timer deadline
      clearTimerDeadline();
      lastTimeoutId = window.setTimeout(() => {
        if (DEBUG_DND_GLOBAL_OVERLAY)
          console.log('forceDragReset: emergency reset of drag state');
        handleDragClear();
      }, TIMEOUT_DRAG_RESET);

      // begin monitoring window blur
      if (!unsubFromWindowBlur) {
        unsubFromWindowBlur = WindowFocusObserver.getInstance().subscribe((focused) => {
          if (!focused) {
            if (DEBUG_DND_GLOBAL_OVERLAY)
              console.log('handleWindowBlur: resetting drag state');
            handleDragClear();
          }
        });
      }

      _setDragState(true, e.dataTransfer || null);
    };

    const handleDragLeave = (e: DragEvent) => {
      // using max to avoid negative numbers - shouldn't happen but those events tend to be flaky in browsers
      dragCounter = Math.max(0, dragCounter - 1);
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragLeave', dragCounter, e.dataTransfer?.types);

      if (dragCounter === 0)
        handleDragClear();
    };


    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragend', handleDragClear);
    document.addEventListener('drop', handleDragClear);

    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragend', handleDragClear);
      document.removeEventListener('drop', handleDragClear);

      // ensure state reset when unmounting
      handleDragClear();
    };
  }, []);

  return !isWindowDragActive ? null : <Box sx={_dragOverlaySx} />;
}
