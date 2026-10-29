import * as React from 'react';

import { ListItemDecorator, MenuItem } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { joyKeepPopup } from './CloseablePopup';
import { useArmedConfirm } from './useArmedConfirm';


/**
 * Menu item behind a two-step confirm. Armed, the item becomes Cancel and the confirm item appears
 * below it - a double-click slip cancels. The menu stays open while arming; its closing unmounts and disarms.
 */
export function ConfirmMenuItem(props: {
  icon?: React.ComponentType, // defaults to DeleteOutline
  confirmIcon?: React.ComponentType, // defaults to `icon`, or DeleteForever when `icon` is the default
  label: React.ReactNode,
  confirmLabel: string,
  disabled?: boolean,
  onConfirm: (event: React.MouseEvent) => void,
}) {

  // state
  const { armed, toggle, confirm } = useArmedConfirm(props.onConfirm);

  const Icon = props.icon ?? DeleteOutlineIcon;
  const ConfirmIcon = props.confirmIcon ?? props.icon ?? DeleteForeverIcon;

  // keep the menu open to show or hide the confirm step - unless Shift-click confirms at once
  const handleToggle = (event: React.MouseEvent) =>
    armed || !event.shiftKey ? joyKeepPopup(toggle)(event) : toggle(event);

  return <>
    <MenuItem color={armed ? 'neutral' : 'danger'} disabled={!armed && props.disabled} onClick={handleToggle}>
      <ListItemDecorator>{armed ? <CloseRoundedIcon /> : <Icon />}</ListItemDecorator>
      {armed ? 'Cancel' : props.label}
    </MenuItem>
    {armed && (
      <MenuItem color='danger' disabled={props.disabled} onClick={confirm}>
        <ListItemDecorator><ConfirmIcon /></ListItemDecorator>
        {props.confirmLabel}
      </MenuItem>
    )}
  </>;
}
