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
    if (options?.disabled || !overlayRef.current) return;
    
    // Find the scrolling container using closest() - try custom boundary first, then role='scrollable'
    const boundarySelector = options?.boundarySelector || '[data-sticky-boundary]';
    const scrollContainer = 
      overlayRef.current.closest(boundarySelector) || 
      overlayRef.current.closest('[role="scrollable"]');
    
    if (!scrollContainer) return; // No scroll container found

    // -- Scrolling interception & element positioning while Active --

    // Sticky positioning logic
    const applyStickyPosition = () => {
      if (!overlayRef.current) return;
      
      const codeContainer = overlayRef.current.parentElement;
      if (!codeContainer) return;
      
      const containerRect = codeContainer.getBoundingClientRect();
      const scrollRect = scrollContainer.getBoundingClientRect();
      const stickyThreshold = scrollRect.top + 2; // 2px offset like chat avatars
      
      const shouldBeSticky = 
        containerRect.top < stickyThreshold && 
        containerRect.bottom > stickyThreshold + 44; // 44px minimum visibility
      
      const overlay = overlayRef.current;
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
      if (!overlayRef.current) return;
      const overlay = overlayRef.current;
      overlay.style.position = '';
      overlay.style.top = '';
      overlay.style.right = '';
      overlay.style.zIndex = '';
    };
    
    const handleScroll = () => requestAnimationFrame(applyStickyPosition);


    // -- Activation/deactivation logic - only when overlay is visible (on hover) --

    const activateStickyBehavior = () => {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
      applyStickyPosition(); // Check initial position
    };
    
    const deactivateStickyBehavior = () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resetToNormalPosition();
    };
    
    const boundaryContainer = overlayBoundaryRef.current || overlayRef.current.parentElement;
    if (boundaryContainer) {
      boundaryContainer.addEventListener('mouseenter', activateStickyBehavior);
      boundaryContainer.addEventListener('mouseleave', deactivateStickyBehavior);
    }
    
    return () => {
      if (boundaryContainer) {
        boundaryContainer.removeEventListener('mouseenter', activateStickyBehavior);
        boundaryContainer.removeEventListener('mouseleave', deactivateStickyBehavior);
      }
      // Ensure scroll listener is removed
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [options?.disabled, options?.boundarySelector]);
  
  return {
    overlayRef,
    overlayBoundaryRef,
  };
}