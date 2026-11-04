import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Textarea, TextareaProps } from '@mui/joy';

import { useUIPreferencesStore } from '~/common/stores/store-ui';

export interface InlineTextareaDraft {
  text: string;
  /** Replace through the browser's editing command to preserve native undo. Returns whether it succeeded. */
  replaceText: (text: string) => boolean;
}

export function InlineTextarea(props: {
  initialText: string,
  disableAutoSaveOnBlur?: boolean // NOTE: this will disable the enter=newline as well
  placeholder?: string,
  size?: TextareaProps['size'],
  decolor?: boolean,
  invertedColors?: boolean,
  centerText?: boolean,
  minRows?: number,
  maxRows?: number, // optional. caps the auto-grow height; beyond it the textarea scrolls (great for single-field inline edits)
  syncWithInitialText?: boolean, // optional. if set, the text will be reset to initialText when the prop changes
  selectAllOnFocus?: boolean, // optional. if set to false, text won't be selected on focus (default: true)
  blurOnDone?: boolean, // optional. release focus from the textarea as editing ends via keyboard (Enter/Escape), so a focusable ancestor (e.g. a ListItemButton) doesn't inherit a stuck focus-visible ring
  explicitSave?: boolean, // Save/Cancel buttons; Enter inserts a newline, Ctrl/Cmd+Enter saves, blur does nothing
  renderStartDecorator?: (draft: InlineTextareaDraft) => React.ReactNode,
  ariaLabel?: string,
  onEdit: (text: string) => void,
  onCancel?: () => void,
  sx?: SxProps,
}) {

  const [text, setText] = React.useState(props.initialText);
  const enterIsNewline = useUIPreferencesStore(state => props.explicitSave || (!props.disableAutoSaveOnBlur && state.enterIsNewline));

  // refs
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const releasingFocusRef = React.useRef(false); // true while a programmatic blur (from Enter/Escape) runs, to suppress its auto-save


  // [effect] optional syncing of the text to the initial text. warning, will discard the current partial edit
  React.useEffect(() => {
    if (props.syncWithInitialText)
      setText(props.initialText);
  }, [props.syncWithInitialText, props.initialText]);


  // handlers

  const handleEditTextChanged = (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value);

  const replaceText = React.useCallback((nextText: string): boolean => {
    const el = textareaRef.current;
    if (!el) return false;
    if (el.value === nextText) return true;
    const { selectionStart, selectionEnd, scrollTop } = el;
    el.focus({ preventScroll: true });
    el.select();
    try {
      // Unlike assigning value/setRangeText, insertText preserves native undo.
      document.execCommand('insertText', false, nextText);
      setText(el.value);
      return el.value === nextText;
    } catch {
      return false;
    } finally {
      el.setSelectionRange(Math.min(selectionStart, el.value.length), Math.min(selectionEnd, el.value.length));
      el.scrollTop = scrollTop;
    }
  }, []);

  // release focus from our own textarea before the parent unmounts us (on keyboard commit/cancel),
  // so the browser doesn't hand focus to the nearest focusable ancestor and leave a stuck ring there
  const releaseFocusIfEnabled = () => {
    if (!props.blurOnDone) return;
    const el = textareaRef.current;
    if (el && document.activeElement === el) {
      releasingFocusRef.current = true; // suppress the auto-save that this blur would otherwise fire
      el.blur();
      releasingFocusRef.current = false;
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing)
        return;
      if (props.explicitSave ? (e.ctrlKey || e.metaKey) : enterIsNewline ? e.shiftKey : !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        if (props.explicitSave && !text.trim()) return;
        releaseFocusIfEnabled();
        props.onEdit(text);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      releaseFocusIfEnabled();
      props.onCancel?.();
    }
  };

  const handleEditBlur = () => {
    if (releasingFocusRef.current) return; // programmatic blur from a keyboard commit/cancel: don't auto-save
    if (!props.disableAutoSaveOnBlur)
      props.onEdit(text);
  };

  return (
    <Textarea
      size={props.size}
      variant={props.explicitSave ? 'outlined' : props.invertedColors ? 'plain' : 'soft'}
      color={props.explicitSave ? 'neutral' : props.decolor ? undefined : props.invertedColors ? 'primary' : 'warning'}
      autoFocus={!props.decolor}
      minRows={props.minRows !== undefined ? props.minRows : 1}
      maxRows={props.maxRows}
      placeholder={props.placeholder}
      value={text}
      onChange={handleEditTextChanged}
      onKeyDown={handleEditKeyDown}
      onBlur={props.explicitSave || props.disableAutoSaveOnBlur ? undefined : handleEditBlur}
      startDecorator={props.renderStartDecorator?.({ text, replaceText })}
      endDecorator={props.explicitSave ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 1, width: '100%' }}>
          <Button size='sm' variant='plain' color='neutral' onClick={props.onCancel} sx={{ minHeight: 36, minWidth: 72 }}>Cancel</Button>
          <Button size='sm' disabled={!text.trim()} onClick={() => props.onEdit(text)} sx={{ minHeight: 36, minWidth: 72 }}>Save</Button>
        </Box>
      ) : undefined}
      slotProps={{
        textarea: {
          ref: textareaRef,
          'aria-label': props.ariaLabel,
          enterKeyHint: enterIsNewline ? 'enter' : 'done',
          ...(props.centerText && {
            sx: { textAlign: 'center' },
          }),
          onFocus: (props.selectAllOnFocus === false) ? undefined : (e) => {
            // Select all text when the textarea receives focus
            // This is a great default behavior for all the inline text edits
            e.target?.select();
          },
        },
      }}
      sx={props.sx}
    />
  );
}
