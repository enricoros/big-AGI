import * as React from 'react';

interface UseStickyCodeOverlayOptions {
  disabled?: boolean;
  /** Custom data attribute to define scroll boundary (default: 'data-sticky-boundary') */
  boundarySelector?: string;
}

/**
 * Makes overlay elements stick to scroll container top during scroll.
 * Performance-optimized: only runs JavaScript when hovering (when overlays are visible).
 * 
 * ```
 * ScrollContainer [role="scrollable" or custom boundary selector]
 *   └── ... (other content)
 *       └── OverlayBoundary (overlayBoundaryRef - hover events + positioning bounds)
 *           └── OverlayElement (overlayRef - gets sticky positioning)
 * ```
 * 
 * Key insights:
 * - overlayBoundaryRef serves dual purpose: hover detection AND positioning bounds calculation
 * - Scroll listeners only active during hover = zero JavaScript execution when not hovering
 * - Fallback: if overlayBoundaryRef unused, defaults to overlay's parent for hover detection
 * - Finds scroll container via closest() with role="scrollable" or custom boundarySelector
 */
export function useStickyCodeOverlay(options?: UseStickyCodeOverlayOptions) {

  // state passed to the caller
  const overlayRef = React.useRef<HTMLElement>(null);
  const overlayBoundaryRef = React.useRef<HTMLElement>(null);


  React.useEffect(() => {
    const overlay = overlayRef.current;
    if (options?.disabled || !overlay) return;
    
    // Find the scrolling container using closest() - try custom boundary first, then role='scrollable'
    const boundarySelector = options?.boundarySelector || '[data-sticky-boundary]';
    const scrollContainer = 
      overlay.closest(boundarySelector) ||
      overlay.closest('[role="scrollable"]');
    
    if (!scrollContainer) return; // No scroll container found

    // -- Scrolling interception & element positioning while Active --

    let pendingFrame: number | null = null;

    // Sticky positioning logic
    const applyStickyPosition = () => {
      const codeContainer = overlay.parentElement;
      if (!codeContainer) return;
      
      const containerRect = codeContainer.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();
      const stickyThreshold = scrollRect.top + 2; // 2px offset like chat avatars
      
      const shouldBeSticky = 
        containerRect.top < stickyThreshold && 
        containerRect.bottom > stickyThreshold + 44; // 44px minimum visibility
      
      if (shouldBeSticky) {
        overlay.style.position = 'fixed';
        overlay.style.top = `${stickyThreshold}px`;
        overlay.style.right = `${window.innerWidth - containerRect.right}px`;
        overlay.style.zIndex = '1';
      } else if (overlay.style.position === 'fixed') {
        resetToNormalPosition();
      }
    };
    
    const resetToNormalPosition = () => {
      overlay.style.position = '';
      overlay.style.top = '';
      overlay.style.right = '';
      overlay.style.zIndex = '';
    };
    
    const handleScroll = () => {
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        applyStickyPosition();
      });
    };


    // -- Activation/deactivation logic - only when overlay is visible (on hover) --

    const activateStickyBehavior = () => {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      applyStickyPosition(); // Check initial position
    };
    
    const deactivateStickyBehavior = () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
        pendingFrame = null;
      }
      resetToNormalPosition();
    };
    
    const boundaryContainer = overlayBoundaryRef.current || overlay.parentElement;
    if (boundaryContainer) {
      boundaryContainer.addEventListener('mouseenter', activateStickyBehavior);
      boundaryContainer.addEventListener('mouseleave', deactivateStickyBehavior);
    }
    
    return () => {
      if (boundaryContainer) {
        boundaryContainer.removeEventListener('mouseenter', activateStickyBehavior);
        boundaryContainer.removeEventListener('mouseleave', deactivateStickyBehavior);
      }
      deactivateStickyBehavior();
    };
  }, [options?.disabled, options?.boundarySelector]);
  
  return {
    overlayRef,
    overlayBoundaryRef,
  };
}
