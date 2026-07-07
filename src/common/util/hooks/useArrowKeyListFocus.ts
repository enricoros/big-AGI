import * as React from 'react';


/**
 * Keyboard Arrow Up/Down navigation across a list of focusable rows, with no per-item state or refs.
 *
 * Rows are discovered by a live DOM query (default selector `[data-agi-nav-item]`) inside `containerRef`
 * at keypress time, so the behavior stays correct as the list filters/reorders/virtualizes, and it never
 * disturbs the rows' memoization. Rows are expected to already be focusable (tabbable or `tabIndex={-1}`);
 * this only adds arrow movement on top of the browser's Tab order.
 *
 * - moves focus by +/-1, clamped at the ends (or wrapping with `{ wrap: true }`)
 * - bails when focus isn't on a row (search field, an editing textarea, ...), leaving default behavior
 * - optional `onFocusedRow(rowElement)` fires after focus moves to a new row - e.g. to preview/open its target
 *
 * Returns a stable onKeyDown handler to spread on the scroll container.
 *
 * To reuse on another list: mark each row element with `data-agi-nav-item` (plus any payload data-* your
 * onFocusedRow needs), give the container a ref, and spread the returned handler on the container.
 */
export function useArrowKeyListFocus(
  containerRef: React.RefObject<HTMLElement>,
  options?: {
    itemSelector?: string,
    wrap?: boolean,
    onFocusedRow?: (rowElement: HTMLElement) => void,
  },
) {

  const { itemSelector = '[data-agi-nav-item]', wrap = false, onFocusedRow } = options ?? {};

  // keep the latest callback in a ref, so the returned handler stays stable across renders
  const onFocusedRowRef = React.useRef(onFocusedRow);
  onFocusedRowRef.current = onFocusedRow;

  return React.useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

    const rows = Array.from(containerRef.current?.querySelectorAll<HTMLElement>(itemSelector) ?? []);
    const currentIndex = rows.indexOf(document.activeElement as HTMLElement);
    if (currentIndex === -1) return; // focus isn't on a row: leave default behavior (cursor in a field, etc.)

    event.preventDefault();
    const delta = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = wrap
      ? (currentIndex + delta + rows.length) % rows.length
      : Math.min(rows.length - 1, Math.max(0, currentIndex + delta));

    const nextRow = rows[nextIndex];
    if (nextRow && nextRow !== document.activeElement) {
      nextRow.focus();
      onFocusedRowRef.current?.(nextRow);
    }
  }, [containerRef, itemSelector, wrap]);
}
