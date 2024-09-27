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

  // Quicker-out: if the key is null, stop here
  if (!event.key)
    return;

  // Quick-out: either the key is escape/left/right, or we have a modifier key pressed -- otherwise we exit
  const lcEventKey = event.key.toLowerCase();
  if (lcEventKey !== 'escape' && lcEventKey !== 'arrowleft' && lcEventKey !== 'arrowright' &&
    !event.ctrlKey && !event.shiftKey && !event.altKey && lcEventKey !== 'enter')
    return;


  const shortcuts = useGlobalShortcutsStore.getState().getAllShortcuts();

  for (const shortcut of shortcuts) {

    // Check if the key matches (case-insensitive)
    if (lcEventKey !== shortcut.key.toLowerCase())
      continue;

    // Check modifier keys
    if ((shortcut.ctrl && !event.ctrlKey) || (!shortcut.ctrl && event.ctrlKey) ||
      (shortcut.shift && !event.shiftKey) || (!shortcut.shift && event.shiftKey))
      continue;

    // Execute the action (and prevent the default browser action)
    event.preventDefault();
    event.stopPropagation();

    if (shortcut.action === '_specialPrintShortcuts')
      console.log('Global Shortcuts:', useGlobalShortcutsStore.getState().shortcutGroups);
    else
      shortcut.action();

    // Stop searching for more shortcuts
    break;
  }
}

let isHandlerInstalled = false;

function _installGlobalShortcutHandler() {
  if (!isHandlerInstalled) {
    window.addEventListener('keydown', _handleGlobalShortcutKeyDown);
    isHandlerInstalled = true;
  }
}

function _uninstallGlobalShortcutHandler() {
  if (isHandlerInstalled) {
    window.removeEventListener('keydown', _handleGlobalShortcutKeyDown);
    isHandlerInstalled = false;
  }
}
