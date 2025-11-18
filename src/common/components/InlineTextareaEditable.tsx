import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';

import { InlineTextarea } from './InlineTextarea';


/**
 * Displays text and switches to edit mode on click
 */
export function InlineTextareaEditable(props: {
  value: string;
  onSave: (newValue: string) => void;
  renderDisplay: (onClickEdit: (event: React.MouseEvent) => void) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  textareaSx?: SxProps;
}) {

  // state
  const [isEditing, setIsEditing] = React.useState(false);
  const valueRef = React.useRef(props.value);
  valueRef.current = props.value;


  // handlers

  const { onSave } = props;

  const handleBeginEditing = React.useCallback((event: React.MouseEvent) => {
    if (props.disabled) return;
    if (event.shiftKey) return; // Reserved for debug/inspect
    setIsEditing(true);
  }, [props.disabled]);

  const handleSave = React.useCallback((newValue: string) => {
    setIsEditing(false);
    const trimmed = newValue.trim();
    if (!trimmed || trimmed === valueRef.current) return;
    onSave(trimmed);
  }, [onSave]);

  const handleCancel = React.useCallback(() => {
    setIsEditing(false);
  }, []);


  // render

  return !isEditing ? props.renderDisplay(handleBeginEditing) : (
    <InlineTextarea
      initialText={props.value}
      placeholder={props.placeholder}
      onEdit={handleSave}
      onCancel={handleCancel}
      sx={props.textareaSx}
    />
  );
}
