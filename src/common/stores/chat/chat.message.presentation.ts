import { shallowEquals } from '~/common/util/hooks/useShallowObject';

import type { DMessage, DMessagePresentation } from './chat.message';


/**
 * Delta for editMessage's updater, applied to the latest message. No-op and pending writes are declined.
 * Undefined removes one override; null resets the whole presentation.
 * Use a final write without touching timestamps: presentation changes must persist/sync, not complete a generation.
 */
export function messagePatchPresentation(message: Pick<DMessage, 'presentation' | 'pendingIncomplete'>, update: Partial<DMessagePresentation> | null): Pick<DMessage, 'presentation'> | false {
  if (message.pendingIncomplete) return false;

  const previous = message.presentation;
  if (update === null)
    return previous === undefined ? false : { presentation: undefined };

  // Preserve unknown fields, and normalize undefined values to absence.
  const merged: DMessagePresentation = Object.fromEntries(
    Object.entries({ ...previous, ...update }).filter(([, value]) => value !== undefined),
  );
  const presentation = Object.keys(merged).length ? merged : undefined;
  if (shallowEquals(previous, presentation)) return false;
  return { presentation };
}

/**
 * Resolve only at the owning consumer. Body text defaults must not become overrides for attachment/other renderers.
 * Unknown future values inherit defaults when read; they remain intact in storage.
 */
export function resolveMessagePresentation(presentation: DMessagePresentation | undefined, defaults: Required<DMessagePresentation>): Required<DMessagePresentation> {
  return {
    textMode: presentation?.textMode === 'plain' || presentation?.textMode === 'markdown' ? presentation.textMode : defaults.textMode,
    fragmentGrouping: presentation?.fragmentGrouping === 'grouped' || presentation?.fragmentGrouping === 'ungrouped' ? presentation.fragmentGrouping : defaults.fragmentGrouping,
  };
}
