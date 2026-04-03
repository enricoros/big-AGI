export type ConversationMinimapEntryKind = 'message' | 'group' | 'trace';

export type ConversationMinimapEntryBounds = {
  id: string;
  top: number;
  height: number;
  kind: ConversationMinimapEntryKind;
  backgroundColor?: string;
  borderColor?: string;
};

export type ConversationMinimapSegment = {
  id: string;
  topRatio: number;
  heightRatio: number;
  kind: ConversationMinimapEntryKind;
  backgroundColor?: string;
  borderColor?: string;
};

export type ConversationMinimapModel = {
  viewportTopRatio: number;
  viewportHeightRatio: number;
  segments: ConversationMinimapSegment[];
};

const MINIMAP_CONTROL_SLOT_HEIGHT_PX = 40;
const MINIMAP_CONTROL_GAP_PX = 8;
const MINIMAP_OVERLAY_INSET_PX = 28;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getConversationMinimapDragGrabOffsetPx(args: {
  trackHeightPx: number;
  viewportHeightRatio: number;
  pointerOffsetWithinViewportPx: number | null;
}): number {
  const viewportHeightPx = Math.max(args.trackHeightPx * args.viewportHeightRatio, 0);
  if (args.pointerOffsetWithinViewportPx === null)
    return viewportHeightPx / 2;
  return clamp(args.pointerOffsetWithinViewportPx, 0, viewportHeightPx);
}

export function buildConversationMinimapModel(args: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
  entries: ConversationMinimapEntryBounds[];
}): ConversationMinimapModel {
  const safeScrollHeight = Math.max(args.scrollHeight, 1);

  return {
    viewportTopRatio: clamp(args.scrollTop / safeScrollHeight, 0, 1),
    viewportHeightRatio: clamp(args.clientHeight / safeScrollHeight, 0, 1),
    segments: args.entries.map(entry => ({
      id: entry.id,
      topRatio: clamp(entry.top / safeScrollHeight, 0, 1),
      heightRatio: clamp(entry.height / safeScrollHeight, 0, 1),
      kind: entry.kind,
      ...(entry.backgroundColor ? { backgroundColor: entry.backgroundColor } : {}),
      ...(entry.borderColor ? { borderColor: entry.borderColor } : {}),
    })),
  };
}

export function getConversationMinimapScrollTop(args: {
  clickOffsetPx: number;
  trackHeightPx: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  const maxScrollTop = Math.max(args.scrollHeight - args.clientHeight, 0);
  if (maxScrollTop === 0 || args.trackHeightPx <= 0)
    return 0;

  const clickRatio = clamp(args.clickOffsetPx / args.trackHeightPx, 0, 1);
  const targetScrollTop = clickRatio * args.scrollHeight - (args.clientHeight / 2);

  return Math.round(clamp(targetScrollTop, 0, maxScrollTop));
}

export function getConversationMinimapScrollTopForViewportTop(args: {
  viewportTopPx: number;
  trackHeightPx: number;
  scrollHeight: number;
  clientHeight: number;
}): number {
  const maxScrollTop = Math.max(args.scrollHeight - args.clientHeight, 0);
  if (maxScrollTop === 0 || args.trackHeightPx <= 0)
    return 0;

  const targetScrollTop = (args.viewportTopPx / args.trackHeightPx) * args.scrollHeight;

  return Math.round(clamp(targetScrollTop, 0, maxScrollTop));
}

export function getConversationMinimapTrackHeightPx(scrollableClientHeight: number): number {
  const containerHeightPx = getConversationMinimapContainerHeightPx(scrollableClientHeight);
  const minimapChromeHeightPx = (MINIMAP_CONTROL_SLOT_HEIGHT_PX * 2)
    + (MINIMAP_CONTROL_GAP_PX * 2);

  return Math.max(Math.round(containerHeightPx - minimapChromeHeightPx), 0);
}

export function getConversationMinimapContainerHeightPx(scrollableClientHeight: number): number {
  return Math.max(Math.round(scrollableClientHeight - MINIMAP_OVERLAY_INSET_PX), 0);
}
