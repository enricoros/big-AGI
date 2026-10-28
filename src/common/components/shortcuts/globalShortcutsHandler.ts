import { useGlobalShortcutsStore } from './store-global-shortcuts';


export function ensureGlobalShortcutHandler() {
  const hasShortcuts = useGlobalShortcutsStore.getState().hasShortcuts;
  if (hasShortcuts && !isHandlerInstalled) {
    _installGlobalShortcutHandler();
  } else if (!hasShortcuts && isHandlerInstalled) {
    _uninstallGlobalShortcutHandler();
  }
}


function _handleGlobalShortcutKeyDown(event: KeyboardEvent) {

  // Leave handled keys and IME composition to the focused control.
  if (event.defaultPrevented || event.isComposing || !event.key)
    return;

  // Quick-out: either the key is escape/left/right, or we have a modifier key pressed -- otherwise we exit
  const lcEventKey = event.key.toLowerCase();
  if (lcEventKey !== 'escape' && lcEventKey !== 'arrowleft' && lcEventKey !== 'arrowright' &&
    !event.ctrlKey && !event.shiftKey && !event.altKey && lcEventKey !== 'enter')
    return;

  // the resolver already applied eligibility and per-combo precedence - first match IS the winner
  for (const shortcut of useGlobalShortcutsStore.getState().resolveShortcuts()) {

    // Check if the key matches (case-insensitive)
    if (lcEventKey !== shortcut.key.toLowerCase())
      continue;

    // Check modifier keys
    if ((shortcut.ctrl && !event.ctrlKey) || (!shortcut.ctrl && event.ctrlKey) ||
      (shortcut.shift && !event.shiftKey) || (!shortcut.shift && event.shiftKey))
      continue;

    // Winner: consume the key; a disabled winner acts like a disabled control - eaten, no action
    event.preventDefault();
    event.stopPropagation();

    if (shortcut.action === '_specialPrintShortcuts')
      console.log('Global Shortcuts:', useGlobalShortcutsStore.getState().shortcutGroups);
    else if (!shortcut.disabled)
      shortcut.action();

    break;
  }
}

// focus moves change read-time eligibility (focusWithin/skipIfInput): tick the store so
// displays re-resolve. Per frame, not per event: the events fire mid-move (focusout sees the
// body as activeElement) and a move can end without a focusin; the frame reads the settled state.
let _focusTickFrame: number | null = null;

function _handleFocusChanged() {
  if (_focusTickFrame !== null) return;
  _focusTickFrame = requestAnimationFrame(() => {
    _focusTickFrame = null;
    useGlobalShortcutsStore.getState().focusTick();
  });
}

let isHandlerInstalled = false;

function _installGlobalShortcutHandler() {
  if (!isHandlerInstalled) {
    window.addEventListener('keydown', _handleGlobalShortcutKeyDown);
    document.addEventListener('focusin', _handleFocusChanged);
    document.addEventListener('focusout', _handleFocusChanged); // blur-to-body fires no focusin
    isHandlerInstalled = true;
  }
}

function _uninstallGlobalShortcutHandler() {
  if (isHandlerInstalled) {
    window.removeEventListener('keydown', _handleGlobalShortcutKeyDown);
    document.removeEventListener('focusin', _handleFocusChanged);
    document.removeEventListener('focusout', _handleFocusChanged);
    if (_focusTickFrame !== null) {
      cancelAnimationFrame(_focusTickFrame);
      _focusTickFrame = null;
    }
    isHandlerInstalled = false;
  }
}
