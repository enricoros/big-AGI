/**
 * Keyboard configuration presets for Big-AGI
 *
 * This module provides a centralized way to handle keyboard shortcuts across the application,
 * supporting different keyboard presets (modes) that users can choose from.
 *
 * Presets:
 * - 'big-agi': Default behavior with Ctrl+Enter triggering Beam
 * - 'classic-send': Classic chat behavior where Ctrl+Enter sends the message
 */


// Types

export type KeyboardPreset = 'big-agi' | 'classic-send';

export type KeyboardAction = 'send' | 'newline' | 'beam' | 'append';

export interface KeyboardMapping {
  enter: KeyboardAction;
  shiftEnter: KeyboardAction;
  ctrlEnter: KeyboardAction;
  altEnter: KeyboardAction;
}


// Preset Definitions

const KEYBOARD_PRESETS: Record<KeyboardPreset, KeyboardMapping> = {
  'big-agi': {
    enter: 'send',
    shiftEnter: 'newline',
    ctrlEnter: 'beam',
    altEnter: 'append',
  },
  'classic-send': {
    enter: 'newline',
    shiftEnter: 'send',
    ctrlEnter: 'send',
    altEnter: 'append',
  },
};


// Mobile always uses newline for Enter (no modifier keys available)
const MOBILE_MAPPING: Partial<KeyboardMapping> = {
  enter: 'newline',
};


/**
 * Get the keyboard mapping for a given preset
 * @param preset - The keyboard preset to use
 * @param isMobile - Whether the device is mobile (forces enter=newline)
 */
export function getKeyboardMapping(preset: KeyboardPreset, isMobile?: boolean): KeyboardMapping {
  const baseMapping = KEYBOARD_PRESETS[preset];
  if (isMobile) {
    return { ...baseMapping, ...MOBILE_MAPPING };
  }
  return baseMapping;
}


/**
 * Determine the action for a keyboard event based on the current preset
 * @param event - The keyboard event (or its relevant properties)
 * @param preset - The keyboard preset to use
 * @param isMobile - Whether the device is mobile
 * @returns The action to perform, or null if the event doesn't match any shortcut
 */
export function getKeyboardActionFromEvent(
  event: { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  preset: KeyboardPreset,
  isMobile?: boolean,
): KeyboardAction | null {
  // Only handle Enter key
  if (event.key !== 'Enter') return null;

  const mapping = getKeyboardMapping(preset, isMobile);

  // Alt+Enter: always append (regardless of other modifiers)
  if (event.altKey && !event.metaKey && !event.ctrlKey) {
    return mapping.altEnter;
  }

  // Ctrl+Enter (or Cmd+Enter on Mac): beam or send based on preset
  if (event.ctrlKey && !event.metaKey && !event.altKey) {
    return mapping.ctrlEnter;
  }

  // Shift+Enter: newline or send based on preset
  if (event.shiftKey) {
    return mapping.shiftEnter;
  }

  // Plain Enter: send or newline based on preset
  return mapping.enter;
}


/**
 * Check if the event should trigger a "send" action (either via Enter or Shift+Enter depending on preset)
 * This is a convenience function for components that just need to know if they should send
 */
export function shouldSendOnEnter(
  event: { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  preset: KeyboardPreset,
  isMobile?: boolean,
): boolean {
  const action = getKeyboardActionFromEvent(event, preset, isMobile);
  return action === 'send';
}


/**
 * Check if the event should trigger a "beam" action
 */
export function shouldBeamOnEnter(
  event: { key: string; shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean },
  preset: KeyboardPreset,
  isMobile?: boolean,
): boolean {
  const action = getKeyboardActionFromEvent(event, preset, isMobile);
  return action === 'beam';
}


/**
 * Get the shortcut string for displaying in UI based on the preset
 * @param action - The action to get the shortcut for
 * @param preset - The keyboard preset
 * @returns Human-readable shortcut string
 */
export function getShortcutForAction(action: KeyboardAction, preset: KeyboardPreset): string {
  const mapping = KEYBOARD_PRESETS[preset];

  if (mapping.enter === action) return 'Enter';
  if (mapping.shiftEnter === action) return 'Shift + Enter';
  if (mapping.ctrlEnter === action) return 'Ctrl + Enter';
  if (mapping.altEnter === action) return 'Alt + Enter';

  return '';
}


/**
 * Get the send shortcut string for the current preset (for UI display)
 */
export function getSendShortcut(preset: KeyboardPreset): string {
  return getShortcutForAction('send', preset);
}


/**
 * Get the beam shortcut string for the current preset (for UI display)
 * Returns empty string if beam is not available via keyboard in this preset
 */
export function getBeamShortcut(preset: KeyboardPreset): string {
  return getShortcutForAction('beam', preset);
}


/**
 * Check if Enter key should behave as newline (for enterKeyHint attribute)
 */
export function enterIsNewline(preset: KeyboardPreset, isMobile?: boolean): boolean {
  const mapping = getKeyboardMapping(preset, isMobile);
  return mapping.enter === 'newline';
}


// Preset metadata for UI

export const KEYBOARD_PRESET_LABELS: Record<KeyboardPreset, string> = {
  'big-agi': 'big-AGI',
  'classic-send': 'Classic Send',
};

export const KEYBOARD_PRESET_DESCRIPTIONS: Record<KeyboardPreset, string> = {
  'big-agi': 'Enter sends, Ctrl+Enter beams',
  'classic-send': 'Shift+Enter sends, Ctrl+Enter sends',
};
