import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { navigateToIndex } from '~/common/app.routes';


/**
 * Operator actions: a tiny bus between the global FAB (in the page chrome) and the apps that can
 * fulfill an action (e.g. AppChat handles home / new chat / incognito).
 *
 * If no app handles the action right now (e.g. we're on /news), we navigate to the chat app and
 * keep the action pending until AppChat subscribes, so it runs as soon as the app mounts.
 */

export type OperatorActionId =
  | 'home'              // landing screen - for now: the chat app with a null (empty) pane
  | 'chat-new'
  | 'chat-incognito'
  | 'doc-new';          // documents are coming - placeholder


type OperatorActionHandler = (action: OperatorActionId) => boolean; // true if handled

const _handlers = new Set<OperatorActionHandler>();
let _pending: OperatorActionId | null = null;


export function operatorSubscribe(handler: OperatorActionHandler): () => void {
  _handlers.add(handler);
  // flush an action that was waiting for an app to mount
  if (_pending) {
    const action = _pending;
    _pending = null;
    setTimeout(() => handler(action), 0);
  }
  return () => {
    _handlers.delete(handler);
  };
}

export function operatorDispatch(action: OperatorActionId): void {

  // not available yet
  if (action === 'doc-new') {
    addSnackbar({ key: 'operator-doc-new', message: 'Documents are coming soon.', type: 'info' });
    return;
  }

  for (const handler of _handlers)
    if (handler(action))
      return;

  // nobody handled it: go to the chat app, and run it once mounted
  _pending = action;
  void navigateToIndex();
}


// --- Command router (prototype) ---

export interface OperatorRoutedCommand {
  action: OperatorActionId | 'ask';
  label: string;          // human readable outcome, shown before executing
  query?: string;         // for 'ask': the question
}

/**
 * Prototype router: keyword rules standing in for the LLM router that will decide between
 * answering, creating a chat, navigating the UI, or editing content.
 */
export function operatorRouteCommand(text: string): OperatorRoutedCommand | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (/\b(home|landing|start ?page|go back)\b/.test(t))
    return { action: 'home', label: 'Going home' };
  if (/\b(incognito|private|temporary|off the record)\b/.test(t))
    return { action: 'chat-incognito', label: 'Opening an incognito chat' };
  if (/\b(doc|document|write up|draft|edit)\b/.test(t))
    return { action: 'doc-new', label: 'Creating a new document' };
  if (/\b(new chat|start a chat|open a chat|chat about)\b/.test(t))
    return { action: 'chat-new', label: 'Starting a new chat' };
  return { action: 'ask', label: 'Answering without memory', query: text.trim() };
}
