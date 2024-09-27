import { ItemAsyncWorker, ProcessingQueue } from '~/common/logic/ProcessingQueue';

import type { DesignerPrompt } from './create/PromptComposer';
import { t2iGenerateImageContentFragments } from '~/modules/t2i/t2i.client';

/**
 * This function needs to create a new image (saved as an DBlob asset) based on the inputs.
 */
const drawCreateWorker: ItemAsyncWorker<DesignerPrompt> = async (item, _update, signal) => {
  await t2iGenerateImageContentFragments(
    null,
    item.prompt,
    item._repeatCount,
    'global', 'app-draw',
  ).catch(console.error);
  return item;
};

export class DrawCreateQueue extends ProcessingQueue<DesignerPrompt> {
  constructor() {
    super(4, 10, drawCreateWorker);
  }
}

/**
 * The single drawing queue for the draw app: keeps running background jobs until done or canceled
 */
export const drawCreateQueue = new DrawCreateQueue();
