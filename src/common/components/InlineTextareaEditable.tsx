import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';

import { InlineTextarea } from './InlineTextarea';


/**
 * Displays text and switches to edit mode on click
 */
export function InlineTextareaEditable(props: {
  value: string;
  onSave: (newValue: string) => void | boolean | Promise<void>; // synchronous false keeps the editor open
  renderDisplay: (onClickEdit: (event: React.MouseEvent) => void) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  textareaSx?: SxProps;
  editorProps?: Omit<React.ComponentProps<typeof InlineTextarea>, 'initialText' | 'onEdit' | 'onCancel' | 'sx'>;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {

  // state
  const [localEditing, setLocalEditing] = React.useState(false);
  const isEditing = props.editing ?? localEditing;
  const valueRef = React.useRef(props.value);
  valueRef.current = props.value;


  // handlers

  const { onSave, onEditingChange } = props;

  const setIsEditing = React.useCallback((editing: boolean) => {
    setLocalEditing(editing);
    onEditingChange?.(editing);
  }, [onEditingChange]);

  const handleBeginEditing = React.useCallback((event: React.MouseEvent) => {
    if (props.disabled) return;
    if (event.shiftKey) return; // Reserved for debug/inspect
    event.stopPropagation();
    setIsEditing(true);
  }, [props.disabled, setIsEditing]);

  const handleSave = React.useCallback((newValue: string) => {
    const trimmed = newValue.trim();
    if (trimmed && trimmed !== valueRef.current && onSave(trimmed) === false) return;
    setIsEditing(false);
  }, [onSave, setIsEditing]);

  const handleCancel = React.useCallback(() => {
    setIsEditing(false);
  }, [setIsEditing]);


  // render

  return !isEditing ? props.renderDisplay(handleBeginEditing) : (
    <InlineTextarea
      initialText={props.value}
      placeholder={props.placeholder}
      {...props.editorProps}
      onEdit={handleSave}
      onCancel={handleCancel}
      sx={props.textareaSx}
    />
  );
}
