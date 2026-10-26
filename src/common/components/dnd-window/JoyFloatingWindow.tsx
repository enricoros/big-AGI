import * as React from 'react';

import { Box } from '@mui/joy';
import { Portal } from '@mui/base';

import type { SxProps } from '@mui/joy/styles/types';
import { joyFloatingWindowManager } from './joyWindowManager';


const _floatingWindowSx: SxProps = {
  position: 'fixed',
  inset: 0,
  zIndex: 'var(--joy-zIndex-modal)',
  outline: 'none',
  pointerEvents: 'none',
  '& > *': { pointerEvents: 'auto' },
} as const;


export function JoyFloatingWindow(props: {
  id: string;
  label: string;
  focusInput?: boolean;
  children: React.ReactNode;
}) {

  const { id, label, focusInput } = props;

  // state
  const [element, setElement] = React.useState<HTMLDivElement | null>(null);
  const initialFocusInput = React.useRef(focusInput);

  // [effect] register after the portal attaches and Joy has registered any invoking dialog.
  React.useEffect(() => {
    if (element) return joyFloatingWindowManager.registerWindow(element, initialFocusInput.current ?? false);
  }, [element]);

  // memos
  const onPointerDownCapture = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target instanceof Node && event.currentTarget.contains(event.target))
      joyFloatingWindowManager.bringToFront(id, false);
  }, [id]);

  const onFocusCapture = React.useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    joyFloatingWindowManager.focusWindowElement(id, event.target);
  }, [id]);

  return (
    <Portal>
      {/* this is a full screen div */}
      <Box
        ref={setElement} id={id}
        data-floating-window={id}
        tabIndex={-1} role='dialog' aria-label={label} aria-modal={false}
        onPointerDownCapture={onPointerDownCapture}
        onFocusCapture={onFocusCapture}
        sx={_floatingWindowSx}
      >
        {props.children}
      </Box>
    </Portal>
  );
}
