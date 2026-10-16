import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';


export function dndDragEndReorder(event: DragEndEvent, ids: string[], onReorder?: (reorderedIds: string[]) => void) {
  const { active, over } = event;

  if (!over || active.id === over.id || !onReorder) return;

  const oldIndex = ids.indexOf(active.id as string);
  const newIndex = ids.indexOf(over.id as string);
  if (oldIndex === -1 || newIndex === -1) return;

  const reorderedIds = arrayMove([...ids], oldIndex, newIndex);
  onReorder(reorderedIds);
}
