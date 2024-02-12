import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Pure async function that operates on an item, can monitor the abort signal, and return or throw
 * optionally it can update progress using the given updateProgress function
 */
export type ItemWorkerFunction<T> =
  (item: T, updateProgress: (progress: number) => void, signal: AbortSignal) => Promise<T>;


/**
 * A queue for processing items of the same type with an async processing function, under the constraints of
 * concurrency limit and rate limit.
 */
export class ProcessingQueue<TItem> extends EventTarget {
  private queue: QueuedItem<TItem>[] = [];
  private inProgress = new Map<string, QueuedItem<TItem>>();
  private rateLimitTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private maxConcurrent: number,
    private rateLimit: number, // Tasks per second
    private itemWorker: ItemWorkerFunction<TItem>,
  ) {
    super();
  }

  // returns a promise that resolves after processing
  enqueueItem(item: TItem, priority: number = 0): Promise<TItem> {
    const taskId = uuidv4();
    const enqueuedAt = Date.now();

    // Create a new AbortController for each task
    const abortController = new AbortController();

    // Return a new promise. The resolve and reject functions of this promise are stored in the task object,
    // so they can be called when the task is processed or if an error occurs.
    // noinspection UnnecessaryLocalVariableJS
    const taskItemPromise = new Promise<TItem>((resolve, reject) => {
      const task: QueuedItem<TItem> = { item, priority, resolve, reject, taskId, enqueuedAt, progress: 0, abortController };
      this.queue.push(task);
      this.sortQueue();
      this.dispatchEvent(new QueueUpdatedEvent(this.getQueueState()));
      this.processQueue();
    });

    return taskItemPromise;
  }

  // cancel a task, either in the queue or being executed
  cancel(taskId: string): void {
    // Check if the task is in the queue and remove it
    this.queue = this.queue.filter(task => task.taskId !== taskId);

    // Check if the task is in progress
    if (this.inProgress.has(taskId)) {
      const task = this.inProgress.get(taskId);
      task?.abortController.abort(); // Abort the task
      this.inProgress.delete(taskId); // Remove the task from inProgress
    }

    // Emit a queue updated event
    this.dispatchEvent(new QueueUpdatedEvent(this.getQueueState()));
  }


  private sortQueue(): void {
    this.queue.sort((a, b) =>
      a.priority !== b.priority
        ? b.priority - a.priority
        : b.enqueuedAt - a.enqueuedAt);
  }

  private processQueue(): void {
    // If the maximum concurrency has been reached, or there are no tasks in the queue, or the rate limit timer is active, return
    if (this.inProgress.size >= this.maxConcurrent || this.queue.length === 0 || this.rateLimitTimer !== null)
      return;

    // Calculate the delay based on the rate limit
    const delay = Math.round(1000 / this.rateLimit);
    this.rateLimitTimer = setTimeout(() => {
      this.rateLimitTimer = null;
      if (this.queue.length === 0) return;

      const task = this.queue.shift()!;
      this.inProgress.set(task.taskId, task);

      const updateProgress = (progress: number) => {
        task.progress = progress;
        this.dispatchEvent(new QueueUpdatedEvent(this.getQueueState()));
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
          // Dev-only message
          console.error(`Task ${task.taskId} failed: ${error.message}`);
        })
        .finally(() => {
          this.dispatchEvent(new QueueUpdatedEvent(this.getQueueState()));
          this.processQueue();
        });
    }, delay);
  }

  getQueueState() {
    return { queueSize: this.queue.length, inProgressSize: this.inProgress.size };
  }

}


type QueuedItem<TItem> = {
  item: TItem;
  priority: number;
  resolve: (value: TItem) => void; // Function to resolve the promise returned by enqueue
  reject: (reason?: any) => void; // Function to reject the promise returned by enqueue
  enqueuedAt: number; // Time the task was enqueued
  taskId: string; // Unique identifier for the task
  progress: number; // Progress of the task
  abortController: AbortController; // Controller to abort the task
}


// Mechanisms for Hooks

class QueueUpdatedEvent extends CustomEvent<{ queueSize: number; inProgressSize: number }> {
  constructor(detail: { queueSize: number; inProgressSize: number }) {
    super('queueUpdated', { detail });
  }
}

export function useProcessingQueueState<TItem>(myItemQueue: ProcessingQueue<TItem>) {

  // initial state
  const [queueState, setQueueState] = React.useState(myItemQueue.getQueueState());

  // state updates
  React.useEffect(() => {
    const handleQueueUpdated = (event: Event) => {
      const queueUpdatedEvent = event as QueueUpdatedEvent;
      setQueueState(queueUpdatedEvent.detail);
    };

    myItemQueue.addEventListener('queueUpdated', handleQueueUpdated);
    return () => myItemQueue.removeEventListener('queueUpdated', handleQueueUpdated);
  }, [myItemQueue]);

  return queueState;
}


// Define the public task information interface
// interface TaskInformation<T> {
//   item: T;
//   priority: number;
//   taskId: string;
//   progress: number;
// }
// Define the error handling strategy type
// type ErrorHandlingStrategy<T> = {
//   retries: number;
//   onRetry: (error: Error, item: T) => void;
//   onGiveUp: (error: Error, item: T) => void;
// };
