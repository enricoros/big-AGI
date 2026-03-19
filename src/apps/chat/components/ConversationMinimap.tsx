import * as React from 'react';

import { Box, IconButton } from '@mui/joy';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import KeyboardDoubleArrowUpIcon from '@mui/icons-material/KeyboardDoubleArrowUp';

import { useScrollToBottom } from '~/common/scroll-to-bottom/useScrollToBottom';

import {
  buildConversationMinimapModel,
  getConversationMinimapContainerHeightPx,
  type ConversationMinimapEntryBounds,
  type ConversationMinimapEntryKind,
  getConversationMinimapDragGrabOffsetPx,
  getConversationMinimapTrackHeightPx,
  getConversationMinimapScrollTopForViewportTop,
  type ConversationMinimapModel,
} from './ConversationMinimap.utils';


const emptyModel: ConversationMinimapModel = {
  viewportTopRatio: 0,
  viewportHeightRatio: 1,
  segments: [],
};

const kindStyles: Record<ConversationMinimapEntryKind, { backgroundColor: string; borderColor: string; }> = {
  message: {
    backgroundColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.62)',
    borderColor: 'rgba(var(--joy-palette-neutral-mainChannel) / 0.28)',
  },
  group: {
    backgroundColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.72)',
    borderColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.34)',
  },
  trace: {
    backgroundColor: 'rgba(var(--joy-palette-warning-mainChannel) / 0.78)',
    borderColor: 'rgba(var(--joy-palette-warning-mainChannel) / 0.34)',
  },
};

const minimapControlButtonSx = {
  backgroundColor: 'background.surface',
  border: '1px solid',
  borderColor: 'neutral.500',
  borderRadius: '50%',
  boxShadow: 'sm',
} as const;

const minimapControlSlotSx = {
  width: '2.5rem',
  height: '2.5rem',
  display: 'grid',
  placeItems: 'center',
  alignSelf: 'center',
  justifySelf: 'center',
} as const;

export function getConversationMinimapControlSlotSx(position: 'top' | 'bottom', visible: boolean) {
  return {
    ...minimapControlSlotSx,
    pointerEvents: visible ? 'auto' : 'none',
  } as const;
}

export function getConversationMinimapRootSx(containerHeightPx: number) {
  return {
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    gap: 1,
    height: `${containerHeightPx}px`,
    width: 'fit-content',
    marginLeft: 'auto',
    overflow: 'hidden',
    pointerEvents: 'none',
  } as const;
}

function areModelsEqual(previous: ConversationMinimapModel, next: ConversationMinimapModel): boolean {
  if (previous === next)
    return true;
  if (previous.viewportTopRatio !== next.viewportTopRatio || previous.viewportHeightRatio !== next.viewportHeightRatio)
    return false;
  if (previous.segments.length !== next.segments.length)
    return false;

  for (let index = 0; index < previous.segments.length; index++) {
    const prevSegment = previous.segments[index];
    const nextSegment = next.segments[index];
    if (!prevSegment || !nextSegment)
      return false;
    if (prevSegment.id !== nextSegment.id
      || prevSegment.kind !== nextSegment.kind
      || prevSegment.topRatio !== nextSegment.topRatio
      || prevSegment.heightRatio !== nextSegment.heightRatio
      || prevSegment.backgroundColor !== nextSegment.backgroundColor
      || prevSegment.borderColor !== nextSegment.borderColor)
      return false;
  }

  return true;
}

function getEntryKind(element: HTMLElement): ConversationMinimapEntryKind | null {
  if (element.getAttribute('role') === 'chat-message')
    return 'message';

  const entryKind = element.dataset.chatMinimapEntry;
  if (entryKind === 'group' || entryKind === 'trace')
    return entryKind;

  return null;
}

function getEntryBoundsForElement(
  element: HTMLElement,
  scrollableElement: HTMLElement,
  scrollableRect: DOMRect,
): ConversationMinimapEntryBounds[] {
  const kind = getEntryKind(element);
  if (!kind)
    return [];

  const bounds = element.getBoundingClientRect();
  if (bounds.height <= 0)
    return [];

  return [{
    id: element.dataset.chatMinimapId || element.id || `${kind}-${bounds.top}-${bounds.height}`,
    top: bounds.top - scrollableRect.top + scrollableElement.scrollTop,
    height: bounds.height,
    kind,
    ...(kind === 'message' && element.dataset.chatMinimapBackgroundColor ? { backgroundColor: element.dataset.chatMinimapBackgroundColor } : {}),
    ...(kind === 'message' && element.dataset.chatMinimapBorderColor ? { borderColor: element.dataset.chatMinimapBorderColor } : {}),
  }];
}

function getNestedTraceEntryElements(traceElement: HTMLElement): HTMLElement[] {
  const nestedTraceEntries = Array.from(traceElement.querySelectorAll<HTMLElement>('[data-chat-minimap-entry="trace"]'));

  return nestedTraceEntries.filter(entry => !entry.querySelector('[data-chat-minimap-entry="trace"]'));
}

function getEntryBounds(listElement: HTMLElement, scrollableElement: HTMLElement): ConversationMinimapEntryBounds[] {
  const scrollableRect = scrollableElement.getBoundingClientRect();

  return Array.from(listElement.children).flatMap(child => {
    if (!(child instanceof HTMLElement))
      return [];

    const kind = getEntryKind(child);
    if (!kind)
      return [];

    if (kind !== 'trace')
      return getEntryBoundsForElement(child, scrollableElement, scrollableRect);

    const nestedTraceEntries = getNestedTraceEntryElements(child);
    if (nestedTraceEntries.length)
      return nestedTraceEntries.flatMap(entry => getEntryBoundsForElement(entry, scrollableElement, scrollableRect));

    return getEntryBoundsForElement(child, scrollableElement, scrollableRect);
  });
}

export function ConversationMinimapControls(props: {
  position: 'top' | 'bottom';
}) {
  const { atBottom, atTop, stickToBottom, scrollToTop, setStickToBottom } = useScrollToBottom();
  const isVisible = props.position === 'top'
    ? atTop === false && !stickToBottom
    : atBottom === false && !stickToBottom;

  const handleScrollToBottom = React.useCallback(() => {
    setStickToBottom(true);
  }, [setStickToBottom]);

  return (
    <Box
      data-conversation-minimap-control-slot
      sx={getConversationMinimapControlSlotSx(props.position, isVisible)}
    >
      {props.position === 'top' && isVisible && (
        <IconButton
          aria-label='Scroll To Top'
          variant='plain'
          onClick={scrollToTop}
          sx={minimapControlButtonSx}
        >
          <KeyboardDoubleArrowUpIcon sx={{ fontSize: 'xl' }} />
        </IconButton>
      )}

      {props.position === 'bottom' && isVisible && (
        <IconButton
          aria-label='Scroll To Bottom'
          variant='plain'
          onClick={handleScrollToBottom}
          sx={minimapControlButtonSx}
        >
          <KeyboardDoubleArrowDownIcon sx={{ fontSize: 'xl' }} />
        </IconButton>
      )}
    </Box>
  );
}

export function ConversationMinimap(props: {
  listRef: React.RefObject<HTMLUListElement | null>;
  showTrack?: boolean;
}) {
  const showTrack = props.showTrack ?? true;
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const scrollableRef = React.useRef<HTMLElement | null>(null);
  const dragPointerIdRef = React.useRef<number | null>(null);
  const dragGrabOffsetRef = React.useRef(0);
  const [isDraggingViewport, setIsDraggingViewport] = React.useState(false);
  const [containerHeightPx, setContainerHeightPx] = React.useState(260);
  const [trackHeightPx, setTrackHeightPx] = React.useState(160);
  const [model, setModel] = React.useState<ConversationMinimapModel>(emptyModel);

  React.useEffect(() => {
    const rootElement = rootRef.current;
    const listElement = props.listRef.current;
    if (!rootElement || !listElement)
      return;

    const scrollableElement = rootElement.closest('[role="scrollable"]');
    if (!(scrollableElement instanceof HTMLElement))
      return;

    scrollableRef.current = scrollableElement;

    let animationFrameId = 0;
    const resizeObserver = new ResizeObserver(() => scheduleSync());
    const mutationObserver = new MutationObserver(() => scheduleSync());

    const sync = () => {
      setContainerHeightPx(previous => {
        const next = getConversationMinimapContainerHeightPx(scrollableElement.clientHeight);
        return previous === next ? previous : next;
      });

      setTrackHeightPx(previous => {
        const next = getConversationMinimapTrackHeightPx(scrollableElement.clientHeight);
        return previous === next ? previous : next;
      });

      if (!showTrack) {
        setModel(previous => areModelsEqual(previous, emptyModel) ? previous : emptyModel);
        return;
      }

      const nextModel = buildConversationMinimapModel({
        scrollHeight: scrollableElement.scrollHeight,
        clientHeight: scrollableElement.clientHeight,
        scrollTop: scrollableElement.scrollTop,
        entries: getEntryBounds(listElement, scrollableElement),
      });

      setModel(previous => areModelsEqual(previous, nextModel) ? previous : nextModel);
    };

    const observeElements = () => {
      resizeObserver.disconnect();
      resizeObserver.observe(scrollableElement);
      if (!showTrack)
        return;

      resizeObserver.observe(listElement);
      Array.from(listElement.children).forEach(child => {
        if (child instanceof HTMLElement)
          resizeObserver.observe(child);
      });
    };

    const scheduleSync = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(() => {
        observeElements();
        sync();
      });
    };

    observeElements();
    sync();

    if (showTrack) {
      scrollableElement.addEventListener('scroll', scheduleSync, { passive: true });
      mutationObserver.observe(listElement, { childList: true, subtree: true, attributes: true });
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
      scrollableElement.removeEventListener('scroll', scheduleSync);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      scrollableRef.current = null;
    };
  }, [props.listRef, showTrack]);

  const updateViewportDragScroll = React.useCallback((clientY: number) => {
    const scrollableElement = scrollableRef.current;
    const trackElement = trackRef.current;
    if (!scrollableElement || !trackElement)
      return;

    const trackBounds = trackElement.getBoundingClientRect();
    const scrollTop = getConversationMinimapScrollTopForViewportTop({
      viewportTopPx: (clientY - trackBounds.top) - dragGrabOffsetRef.current,
      trackHeightPx: trackBounds.height,
      scrollHeight: scrollableElement.scrollHeight,
      clientHeight: scrollableElement.clientHeight,
    });

    scrollableElement.scrollTo({ top: scrollTop, behavior: 'auto' });
  }, []);

  const handleTrackPointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const trackElement = event.currentTarget;
    const viewportElement = viewportRef.current;
    if (!trackElement || !viewportElement)
      return;

    dragPointerIdRef.current = event.pointerId;
    dragGrabOffsetRef.current = getConversationMinimapDragGrabOffsetPx({
      trackHeightPx: trackElement.getBoundingClientRect().height,
      viewportHeightRatio: model.viewportHeightRatio,
      pointerOffsetWithinViewportPx: viewportElement.contains(event.target as Node)
        ? event.clientY - viewportElement.getBoundingClientRect().top
        : null,
    });
    setIsDraggingViewport(true);

    trackElement.setPointerCapture(event.pointerId);
    updateViewportDragScroll(event.clientY);
    event.preventDefault();
    event.stopPropagation();
  }, [model.viewportHeightRatio, updateViewportDragScroll]);

  const handleTrackPointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId)
      return;

    updateViewportDragScroll(event.clientY);
    event.preventDefault();
    event.stopPropagation();
  }, [updateViewportDragScroll]);

  const finishViewportDrag = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (dragPointerIdRef.current !== event.pointerId)
      return;

    dragPointerIdRef.current = null;
    dragGrabOffsetRef.current = 0;
    setIsDraggingViewport(false);
    event.preventDefault();
    event.stopPropagation();
  }, []);

  return (
    <Box
      ref={rootRef}
      sx={getConversationMinimapRootSx(containerHeightPx)}
    >
      <ConversationMinimapControls position='top' />

      {showTrack ? (
        <Box
          ref={trackRef}
          aria-label='Conversation minimap'
          onPointerCancel={finishViewportDrag}
          onPointerDown={handleTrackPointerDown}
          onPointerMove={handleTrackPointerMove}
          onPointerUp={finishViewportDrag}
          sx={{
            position: 'relative',
            width: '2.85rem',
            height: `${trackHeightPx}px`,
            borderRadius: 'xl',
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(180deg, rgba(var(--joy-palette-neutral-mainChannel) / 0.08) 0%, rgba(var(--joy-palette-neutral-mainChannel) / 0.14) 100%)',
            boxShadow: 'sm',
            overflow: 'hidden',
            cursor: isDraggingViewport ? 'grabbing' : 'pointer',
            userSelect: 'none',
            touchAction: 'none',
            pointerEvents: 'auto',
            transition: 'border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease',
            '&:hover': {
              borderColor: 'neutral.softColor',
              boxShadow: 'md',
              transform: 'translateY(-1px)',
            },
          }}
        >
          {model.segments.map((segment, index) => {
            const segmentStyle = {
              backgroundColor: segment.backgroundColor || kindStyles[segment.kind].backgroundColor,
              borderColor: segment.borderColor || kindStyles[segment.kind].borderColor,
            };
            return (
              <Box
                key={segment.id}
                sx={{
                  position: 'absolute',
                  left: index % 2 === 0 ? '16%' : '20%',
                  right: index % 2 === 0 ? '16%' : '20%',
                  top: `calc(${(segment.topRatio * 100).toFixed(4)}% + 1px)`,
                  height: `max(calc(${(segment.heightRatio * 100).toFixed(4)}% - 2px), 2px)`,
                  borderRadius: '999px',
                  border: '1px solid',
                  backgroundColor: segmentStyle.backgroundColor,
                  borderColor: segmentStyle.borderColor,
                  boxShadow: '0 0 0 1px rgba(0 0 0 / 0.08)',
                  opacity: 0.96,
                }}
              />
            );
          })}

          <Box
            ref={viewportRef}
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'absolute',
              left: '8%',
              right: '8%',
              top: `${(model.viewportTopRatio * 100).toFixed(4)}%`,
              height: `${(model.viewportHeightRatio * 100).toFixed(4)}%`,
              minHeight: '1.5rem',
              borderRadius: 'lg',
              border: '1px solid',
              borderColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.52)',
              backgroundColor: 'rgba(var(--joy-palette-primary-mainChannel) / 0.14)',
              boxShadow: '0 0 0 1px rgba(var(--joy-palette-common-blackChannel) / 0.12)',
              cursor: isDraggingViewport ? 'grabbing' : 'grab',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
          />
        </Box>
      ) : (
        <Box
          aria-hidden='true'
          sx={{
            width: '2.85rem',
            height: `${trackHeightPx}px`,
            pointerEvents: 'none',
          }}
        />
      )}

      <ConversationMinimapControls position='bottom' />
    </Box>
  );
}
