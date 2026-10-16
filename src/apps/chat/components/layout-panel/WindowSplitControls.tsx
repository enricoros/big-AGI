import * as React from 'react';

import { IconButton, ListItem, ListItemButton, ListItemDecorator, Tooltip } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';

import { CodiconSplitHorizontal } from '~/common/components/icons/CodiconSplitHorizontal';
import { CodiconSplitHorizontalRemove } from '~/common/components/icons/CodiconSplitHorizontalRemove';
import { CodiconSplitVertical } from '~/common/components/icons/CodiconSplitVertical';
import { CodiconSplitVerticalRemove } from '~/common/components/icons/CodiconSplitVerticalRemove';

import { panesManagerActions, usePaneDuplicateOrClose } from '../panes/store-panes-manager';


export function WindowSplitControls(props: {
  isVerticalSplit: boolean,
}) {

  // external state
  const { canAddPane, isMultiPane } = usePaneDuplicateOrClose();


  // Window

  const handleIncreaseMultiPane = React.useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();

    // create a new pane with the current conversation
    // duplicateFocusedPane();

    // create a new empty pane
    panesManagerActions().insertEmptyAfterFocusedPane(true);

    // load a brand new conversation inside
    // FIXME: still testing this
    // props.onConversationNew(true);
  }, []);

  const handleToggleMultiPane = React.useCallback((_event: React.MouseEvent) => {
    if (isMultiPane)
      panesManagerActions().removeNonFocusedPanes();
    else
      handleIncreaseMultiPane(undefined);
  }, [handleIncreaseMultiPane, isMultiPane]);


  return (
    <ListItem
      endAction={!isMultiPane ? undefined : (
        <Tooltip title='Add Another Split'>
          <IconButton
            size='sm'
            variant='outlined'
            disabled={!canAddPane}
            onClick={handleIncreaseMultiPane}
            sx={{ ml: 'auto', /*mr: '2px',*/ my: '-0.25rem' /* absorb the menuItem padding */ }}
          >
            <AddIcon />
          </IconButton>
        </Tooltip>
      )}
    >
      <ListItemButton onClick={handleToggleMultiPane}>
        <ListItemDecorator>{props.isVerticalSplit
          ? (isMultiPane ? <CodiconSplitVerticalRemove /> : <CodiconSplitVertical />)
          : (isMultiPane ? <CodiconSplitHorizontalRemove /> : <CodiconSplitHorizontal />)
        }</ListItemDecorator>
        {props.isVerticalSplit
          ? (isMultiPane ? 'Unsplit' : 'Split Down')
          : (isMultiPane ? 'Unsplit' : 'Split Right')}
      </ListItemButton>
    </ListItem>
  );
}
