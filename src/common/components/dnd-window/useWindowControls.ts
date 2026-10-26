import * as React from 'react';

import { DDndWindowPosition, DDndWindowSize, getEventClientCoords, getPositionWithinBounds, shouldDragAndPreventDefault } from './windowUtils';

export { DraggableWindowTitle } from './DraggableWindowTitle'; // re-export for convenience


// configuration
const ENABLE_CURSOR_CHANGE = true;


// -- convenience functions for resizing/cursor --

function _detectResizeEdge(container: HTMLDivElement | null, e: React.MouseEvent | React.TouchEvent): WindowResizeEdge | null {
  if (!container || !e) return null;

  const coords = getEventClientCoords(e);
  if (!coords) return null;

  const rect = container.getBoundingClientRect();
  const threshold = 12; // px

  const nearTop = coords.clientY - rect.top < threshold;
  const nearBottom = rect.bottom - coords.clientY < threshold;
  const nearLeft = coords.clientX - rect.left < threshold;
  const nearRight = rect.right - coords.clientX < threshold;

  // corners have priority
  if (nearTop && nearLeft) return 'nw';
  if (nearTop && nearRight) return 'ne';
  if (nearBottom && nearLeft) return 'sw';
  if (nearBottom && nearRight) return 'se';

  // edges
  if (nearTop) return 'n';
  if (nearBottom) return 's';
  if (nearLeft) return 'w';
  if (nearRight) return 'e';

  return null;
}

function _getResizeCursor(edge: WindowResizeEdge | null): string {
  if (!edge) return 'auto'; // 'auto' allows child elements to control cursor (e.g., text cursor)
  const cursorMap: Record<WindowResizeEdge, string> = {
    n: 'ns-resize',
    s: 'ns-resize',
    e: 'ew-resize',
    w: 'ew-resize',
    ne: 'nesw-resize',
    nw: 'nwse-resize',
    se: 'nwse-resize',
    sw: 'nesw-resize',
  };
  return cursorMap[edge];
}


interface UseWindowControlsOptions {
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
}

type WindowResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type InteractionState = 'idle' | 'dragging' | 'resizing';


export function useWindowControls(
  isVisible: boolean,
  initialPosition: DDndWindowPosition,
  onPositionChange: (position: DDndWindowPosition) => void,
  initialSize: DDndWindowSize,
  onSizeChange: (size: DDndWindowSize) => void,
  options?: UseWindowControlsOptions,
) {

  // destructure
  const {
    minWidth = 320,
    maxWidth = 2048,
    minHeight = 240,
    maxHeight = 2048,
  } = options || {};

  // state
  const [interacting, setInteracting] = React.useState<InteractionState>('idle');
  const [resizeEdge, setResizeEdge] = React.useState<WindowResizeEdge | null>(null);

  // refs to track state without re-renders
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const positionRef = React.useRef(initialPosition);
  const sizeRef = React.useRef(initialSize);
  const downOffset = React.useRef<DDndWindowPosition>({ x: 0, y: 0 });
  const resizeStartState = React.useRef<{ x: number; y: number; width: number; height: number } | null>(null);


  // helpers to store position/size in refs and update CSS directly

  const updateCSSPosition = React.useCallback((newPosition: DDndWindowPosition) => {
    positionRef.current = newPosition;
    if (containerRef.current) {
      containerRef.current.style.left = `${newPosition.x}px`;
      containerRef.current.style.top = `${newPosition.y}px`;
    }
  }, [containerRef]);

  const updateCSSSize = React.useCallback((newSize: DDndWindowSize) => {
    sizeRef.current = newSize;
    if (containerRef.current) {
      containerRef.current.style.width = typeof (newSize.width as unknown) === 'number' ? `${newSize.width}px` : 'revert-layer';
      containerRef.current.style.height = typeof (newSize.height as unknown) === 'number' ? `${newSize.height}px` : 'revert-layer';
    }
  }, [containerRef]);


  // Initialize when the element attaches, including after a portal mounts its children.
  const handleContainerRef = React.useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element;
    if (!isVisible || !element) return;

    // ensure initial position is within bounds
    const boundedPosition = getPositionWithinBounds(element, initialPosition);
    if (boundedPosition.x !== initialPosition.x || boundedPosition.y !== initialPosition.y)
      onPositionChange(boundedPosition);

    updateCSSPosition(boundedPosition);
    updateCSSSize(initialSize);
  }, [containerRef, initialPosition, initialSize, isVisible, onPositionChange, updateCSSPosition, updateCSSSize]);


  // [effect] browser window resize -> keep within bounds
  React.useEffect(() => {
    if (!isVisible || typeof window === 'undefined') return;

    const handleResize = () => {
      const boundedPosition = getPositionWithinBounds(containerRef.current, positionRef.current);
      onPositionChange(boundedPosition);
      updateCSSPosition(boundedPosition);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [containerRef, isVisible, onPositionChange, updateCSSPosition]);


  // Drag: mouse/touch down
  const handleDragStart = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // For mouse events, only handle left button
    if ('button' in e && e.button !== 0) return;
    if (!shouldDragAndPreventDefault(e)) return;

    const coords = getEventClientCoords(e);
    if (!coords) return;

    setInteracting('dragging');
    downOffset.current = {
      x: coords.clientX - positionRef.current.x,
      y: coords.clientY - positionRef.current.y,
    };

    // execution will continue in document mouse/touch move/up handlers
  }, []);


  // Resize: mouse/touch down
  const handleResizeStart = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
    // For mouse events, only handle left button
    if ('button' in e && e.button !== 0) return;

    // check if we clicked on a resize edge
    const edge = _detectResizeEdge(containerRef.current, e);
    if (!edge) return;
    // Note: drag is handled separately by DraggableWindowTitle

    // only prevent default if we're actually on a resize edge
    if (!shouldDragAndPreventDefault(e)) return;

    const coords = getEventClientCoords(e);
    if (!coords) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setInteracting('resizing');
    setResizeEdge(edge);
    resizeStartState.current = {
      x: positionRef.current.x,
      y: positionRef.current.y,
      width: rect.width,
      height: rect.height,
    };
    downOffset.current = {
      x: coords.clientX,
      y: coords.clientY,
    };

    // execution will continue in document mouse/touch move/up handlers
  }, [containerRef]);

  // Resize: CURSOR: pre-drag/resize mouse move - to set the resize cursor (both resize and drag)
  const handleResizeIdleMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (interacting !== 'idle') return;

    // update cursor based on hover position
    if (containerRef.current) {
      const edge = _detectResizeEdge(containerRef.current, e);
      containerRef.current.style.cursor = _getResizeCursor(edge);
    }
  }, [containerRef, interacting]);


  // During Interaction: Document-level mouse/touch move
  const handleDocumentMove = React.useCallback((e: MouseEvent | TouchEvent) => {
    const coords = getEventClientCoords(e);
    if (!coords) return;

    if (interacting === 'dragging') {

      const newX = coords.clientX - downOffset.current.x;
      const newY = coords.clientY - downOffset.current.y;
      const boundedPosition = getPositionWithinBounds(containerRef.current, { x: newX, y: newY });

      // immediate CSS update and store position in ref
      updateCSSPosition(boundedPosition);

    } else if (interacting === 'resizing' && resizeEdge && resizeStartState.current) {

      const deltaX = coords.clientX - downOffset.current.x;
      const deltaY = coords.clientY - downOffset.current.y;

      const { x: startX, y: startY, width: startWidth, height: startHeight } = resizeStartState.current;

      let newX = startX;
      let newY = startY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // calculate new dimensions based on edge string combo
      if (resizeEdge.includes('e'))
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth + deltaX));
      if (resizeEdge.includes('w')) {
        newWidth = Math.max(minWidth, Math.min(maxWidth, startWidth - deltaX));
        newX = startX + (startWidth - newWidth); // when resizing from left, adjust position
      }
      if (resizeEdge.includes('s'))
        newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + deltaY));
      if (resizeEdge.includes('n')) {
        newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight - deltaY));
        newY = startY + (startHeight - newHeight); // when resizing from top, adjust position
      }

      // immediate CSS update and store size/position in ref
      updateCSSSize({ width: newWidth, height: newHeight });
      updateCSSPosition({ x: newX, y: newY });
    }
  }, [containerRef, interacting, maxHeight, maxWidth, minHeight, minWidth, resizeEdge, updateCSSPosition, updateCSSSize]);

  // During Interaction: Document-level mouse/touch up (end interaction)
  const handleDocumentEnd = React.useCallback(() => {

    // send final position/size to parent
    if (interacting === 'dragging') {
      onPositionChange(positionRef.current);
    } else if (interacting === 'resizing') {
      onSizeChange(sizeRef.current);
      onPositionChange(positionRef.current);
    }

    // reset interaction state
    setInteracting('idle');
    setResizeEdge(null);
    resizeStartState.current = null;

    // reset container's cursor to auto (allows child elements to control cursor)
    if (ENABLE_CURSOR_CHANGE && containerRef.current)
      containerRef.current.style.cursor = 'auto';
  }, [containerRef, interacting, onPositionChange, onSizeChange]);


  // Interaction start: add document mouse/touch move/up listeners
  React.useEffect(() => {
    if (interacting !== 'idle') {
      // Mouse events
      document.addEventListener('mousemove', handleDocumentMove);
      document.addEventListener('mouseup', handleDocumentEnd);
      // Touch events - use passive: false to allow preventDefault() in touchmove
      document.addEventListener('touchmove', handleDocumentMove, { passive: false });
      document.addEventListener('touchend', handleDocumentEnd);
      document.addEventListener('touchcancel', handleDocumentEnd);
      return () => {
        document.removeEventListener('mousemove', handleDocumentMove);
        document.removeEventListener('mouseup', handleDocumentEnd);
        document.removeEventListener('touchmove', handleDocumentMove);
        document.removeEventListener('touchend', handleDocumentEnd);
        document.removeEventListener('touchcancel', handleDocumentEnd);
      };
    }
  }, [interacting, handleDocumentMove, handleDocumentEnd]);


  return {
    ref: handleContainerRef,
    windowInteraction: interacting,
    handleDragStart, // Drag handler - use handleDragStart for both onMouseDown and onTouchStart
    handleResizeStart, // Resize handlers -start for both mouse/touch, mouse move for cursor
    handleResizeMouseMove: ENABLE_CURSOR_CHANGE ? handleResizeIdleMouseMove : undefined,
  };
}
