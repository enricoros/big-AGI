import * as React from 'react';

import { Box } from '@mui/joy';

import { animationOpacityFadeIn } from '~/common/util/animUtils';
import { themeZIndexDragOverlay } from '~/common/app.theme';

import { EXCLUDE_SELF_TYPE } from './useDragDropDataTransfer';
import { useGlobalDragStore } from './volstore-drag-global';


// configuration
const DEBUG_DND_GLOBAL_OVERLAY = false;


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

    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      dragCounter = dragCounter < 0 ? 1 : dragCounter + 1;
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragEnter', dragCounter, e.dataTransfer?.types);

      // Skip if this came from within our app
      if (e.dataTransfer?.types.includes(EXCLUDE_SELF_TYPE))
        return;

      _setDragState(true, e.dataTransfer || null);
    };

    const handleDragLeave = (e: DragEvent) => {
      dragCounter--;
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragLeave', dragCounter, e.dataTransfer?.types);

      if (dragCounter === 0)
        _setDragState(false);
    };

    const handleDragClear = () => {
      dragCounter = 0;
      if (DEBUG_DND_GLOBAL_OVERLAY)
        console.log('handleDragClear');
      _setDragState(false);
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
      _setDragState(false);
    };
  }, []);

  return !isWindowDragActive ? null : <Box sx={_dragOverlaySx} />;
}
