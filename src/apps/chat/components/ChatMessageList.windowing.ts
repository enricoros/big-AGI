import type { CouncilTraceRenderItem } from './ChatMessageList.councilTrace';
import type { DMessage } from '~/common/stores/chat/chat.message';


export type MessageDecoratorKind = 'leader' | 'provisional' | 'system';

export type CouncilGroupEntry = {
  kind: 'group';
  key: string;
  label: string;
  messages: DMessage[];
  passIndex: number;
};

export type SingleMessageEntry = {
  kind: 'message';
  key: string;
  message: DMessage;
};

export type GroupedVisibleEntry = CouncilGroupEntry | SingleMessageEntry;

export type RenderedGroupMessageEntry = {
  message: DMessage;
  topDecoratorKind: MessageDecoratorKind | undefined;
  topDecoratorCompact: true;
  topDecoratorFirst: boolean;
};

export type GroupedVisibleRenderEntry =
  | (CouncilGroupEntry & { renderedMessages: RenderedGroupMessageEntry[] })
  | (SingleMessageEntry & { topDecoratorKind: MessageDecoratorKind | undefined });

export type CouncilTraceVisibleEntry = {
  kind: 'council-trace';
  key: string;
  trace: CouncilTraceRenderItem;
};

export type VisibleRenderEntry = GroupedVisibleRenderEntry | CouncilTraceVisibleEntry;

export function countVisibleRenderEntryUnits(entry: VisibleRenderEntry): number {
  return entry.kind === 'group'
    ? Math.max(1, entry.messages.length)
    : 1;
}

export function sliceVisibleRenderEntriesFromEnd(entries: VisibleRenderEntry[], maxUnits: number): VisibleRenderEntry[] {
  if (!entries.length || !Number.isFinite(maxUnits))
    return entries;

  const normalizedMaxUnits = Math.max(1, Math.floor(maxUnits));
  let remainingUnits = normalizedMaxUnits;
  let sliceStart = entries.length - 1;

  for (let index = entries.length - 1; index >= 0; index--) {
    const entryUnits = countVisibleRenderEntryUnits(entries[index]!);
    const canInclude = index === entries.length - 1 || remainingUnits - entryUnits >= 0;
    if (!canInclude)
      break;

    sliceStart = index;
    remainingUnits -= entryUnits;
  }

  return sliceStart <= 0 ? entries : entries.slice(sliceStart);
}
