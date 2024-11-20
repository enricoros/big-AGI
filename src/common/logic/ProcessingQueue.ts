import * as React from 'react';
import { EventEmitter } from 'events';
import { agiUuid } from '~/common/util/idUtils';

export type ItemAsyncWorker<T> =
  (item: T, updateProgress: (progress: number) => void, signal: AbortSignal) => Promise<T>;

export type QueuedItem<TItem> = {
  item: TItem;
  priority: number;
  resolve: (value: TItem) => void;
  reject: (reason?: any) => void;
  enqueuedAt: number;
  taskId: string;
  progress: number;
  abortController: AbortController;
}

type QueueState<TItem> = {
  totalSize: number;
  queueSize: number;
  inProgressSize: number;
  items: QueuedItem<TItem>[];
};

export class ProcessingQueue<TItem> extends EventEmitter {
  private queue: QueuedItem<TItem>[] = [];
  private inProgress = new Map<string, QueuedItem<TItem>>();
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private maxConcurrent: number,
    private rateLimit: number, // Tasks per second
    private itemWorker: ItemAsyncWorker<TItem>,
  ) {
    super();
  }

  enqueueItem(item: TItem, priority: number = 0): Promise<TItem> {
    const taskId = agiUuid('processing-queue-task');
    const enqueuedAt = Date.now();
    const abortController = new AbortController();

    const taskItemPromise = new Promise<TItem>((resolve, reject) => {
      const task: QueuedItem<TItem> = { item, priority, resolve, reject, taskId, enqueuedAt, progress: 0, abortController };
      this.queue.push(task);
      this.sortQueue();
      this.emit('queueUpdated', this.getQueueState());
      this.processQueue();
    });

    return taskItemPromise;
  }

  cancel(taskId: string): void {
    this.queue = this.queue.filter(task => task.taskId !== taskId);

    if (this.inProgress.has(taskId)) {
      const task = this.inProgress.get(taskId);
      task?.abortController.abort();
      this.inProgress.delete(taskId);
    }

    this.emit('queueUpdated', this.getQueueState());
  }

  cancelAll(): void {
    this.queue = [];
    this.inProgress.forEach(task => task.abortController.abort());
    this.inProgress.clear();
    this.emit('queueUpdated', this.getQueueState());
  }

  private sortQueue(): void {
    this.queue.sort((a, b) =>
      a.priority !== b.priority
        ? b.priority - a.priority
        : b.enqueuedAt - a.enqueuedAt);
  }

  private processQueue(): void {
    if (this.inProgress.size >= this.maxConcurrent || this.queue.length === 0 || this.rateLimitTimer !== null)
      return;

    const delay = Math.round(1000 / this.rateLimit);
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimitTimer = null;
      if (this.queue.length === 0) return;

      const task = this.queue.shift()!;
      this.inProgress.set(task.taskId, task);

      const updateProgress = (progress: number) => {
        task.progress = progress;
        this.emit('queueUpdated', this.getQueueState());
      };

      updateProgress(0);

      this.itemWorker(task.item, updateProgress, task.abortController.signal)
        .then(result => {
          task.resolve(result);
          task.progress = 100;
          this.inProgress.delete(task.taskId);
        })
        .catch(error => {
          task.reject(error);
          this.inProgress.delete(task.taskId);
          console.error(`Task ${task.taskId} failed: ${error.message}`);
        })
        .finally(() => {
          this.emit('queueUpdated', this.getQueueState());
          this.processQueue();
        });
    }, delay);
  }

  getQueueState(): QueueState<TItem> {
    return {
      totalSize: this.queue.length + this.inProgress.size,
      queueSize: this.queue.length,
      inProgressSize: this.inProgress.size,
      items: [...this.inProgress.values(), ...this.queue],
    };
  }
}

export function useProcessingQueue<TItem>(myItemQueue: ProcessingQueue<TItem>) {
  const [queueState, setQueueState] = React.useState(myItemQueue.getQueueState());

  React.useEffect(() => {
    const handleQueueUpdated = (newQueueState: QueueState<TItem>) => {
      setQueueState(newQueueState);
    };

    myItemQueue.on('queueUpdated', handleQueueUpdated);
    return () => {
      myItemQueue.off('queueUpdated', handleQueueUpdated);
    };
  }, [myItemQueue]);

  const queueAddItem = React.useCallback((item: TItem, priority: number = 0) => myItemQueue.enqueueItem(item, priority), [myItemQueue]);
  const queueCancelAll = React.useCallback(() => myItemQueue.cancelAll(), [myItemQueue]);

  return { queueState, queueAddItem, queueCancelAll };
}
