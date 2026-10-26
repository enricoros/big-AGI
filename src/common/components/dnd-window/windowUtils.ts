import * as React from 'react';


// Types

export interface DDndWindowPosition {
  x: number;
  y: number;
}

export interface DDndWindowSize {
  width: number | 'auto';
  height: number | 'auto';
}


// Utility Functions

/**
 * Extract client coordinates from either a MouseEvent or TouchEvent.
 * For touch events during move, uses `touches[0]`. For touch end, uses `changedTouches[0]`.
 */
export function getEventClientCoords(e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent): { clientX: number; clientY: number } | null {
  if ('touches' in e) {
    // TouchEvent: use touches[0] if available (during move), otherwise changedTouches[0] (at end)
    const touch = e.touches[0] || e.changedTouches[0];
    return touch ? { clientX: touch.clientX, clientY: touch.clientY } : null;
  }
  // MouseEvent
  return { clientX: e.clientX, clientY: e.clientY };
}

/**
 * Check if a drag should be initiated (not on interactive elements) and prevent default behavior (selection on drag, usually)
 */
export function shouldDragAndPreventDefault(e: React.MouseEvent | React.TouchEvent): boolean {
  // Don't start dragging if clicked on an interactive element
  const target = e.target as HTMLElement;
  if (target.closest('button, a, input, textarea, select, [contenteditable="true"]'))
    return false;

  // Prevent mouse selection; React's passive touch listeners cannot cancel browser gestures.
  if (!('touches' in e)) e.preventDefault();
  return true;
}

/**
 * Constrain an element position to stay within the browser viewport bounds.
 */
export function getPositionWithinBounds(element: HTMLDivElement | null, pos: DDndWindowPosition): DDndWindowPosition {
  if (!element || typeof window === 'undefined') return pos;

  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const maxX = window.innerWidth - width;
  const maxY = window.innerHeight - height;

  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  };
}