import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, ListDivider, ListItem, ListItemButton, ListItemDecorator, Switch, Typography } from '@mui/joy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import type { SharedChatLinkItem } from '~/modules/trade/link/store-share-link';

import { Link } from '~/common/components/Link';
import { OptimaDrawerHeader } from '~/common/layout/optima/drawer/OptimaDrawerHeader';
import { OptimaDrawerList } from '~/common/layout/optima/drawer/OptimaDrawerList';
import { getChatLinkRelativePath } from '~/common/app.routes';
import { optimaCloseDrawer } from '~/common/layout/optima/useOptima';


/**
 * Drawer Items are all the links already shared, for quick access.
 * This is stores in the Trade Store (local storage).
 */
export function LinkChatDrawer(props: {
  activeLinkId: string | null,
  sharedChatLinkItems: SharedChatLinkItem[]
  onDeleteLink: (linkId: string) => void,
}) {

  // state
  const [showDeletionKeys, setShowDeletionKeys] = React.useState<boolean>(false);

  // derived state
  const { activeLinkId, onDeleteLink } = props;
  const chatLinkItems = props.sharedChatLinkItems.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  const hasLinks = chatLinkItems.length > 0;


  const handleDeleteLink = React.useCallback(() => {
    activeLinkId && onDeleteLink(activeLinkId);
  }, [activeLinkId, onDeleteLink]);

  const handleToggleDeletionKeys = React.useCallback(() => {
    setShowDeletionKeys(on => !on);
  }, []);


  return <>

    <OptimaDrawerHeader
      title='Your Shared Links'
      onClose={optimaCloseDrawer}
    />

    <OptimaDrawerList variant='plain' noTopPadding noBottomPadding tallRows>

      <ListItem>
        <Typography level='body-sm'>
          {hasLinks ? 'Links shared by you' : 'No prior shared links'}
        </Typography>
      </ListItem>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>

        {hasLinks && <Box sx={{ overflowY: 'auto' }}>
          {chatLinkItems.map(item => (
            <ListItemButton
              key={'chat-link-' + item.objectId}
              variant={activeLinkId === item.objectId ? 'soft' : undefined}
              component={Link} href={getChatLinkRelativePath(item.objectId)} noLinkStyle
              sx={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Box>
                <Typography level='title-sm'>
                  {item.chatTitle || 'Untitled Chat'}
                </Typography>
                {showDeletionKeys && <Typography level='body-xs'>
                  Deletion Key: {item.deletionKey}
                </Typography>}
                <Typography level='body-xs'>
                  <TimeAgo date={item.createdAt} />
                </Typography>
              </Box>
            </ListItemButton>
          ))}
        </Box>}

      </Box>

      <ListDivider sx={{ my: 0 }} />

      <ListItemButton disabled={!hasLinks || !activeLinkId} onClick={handleDeleteLink}>
        <ListItemDecorator>
          <DeleteOutlineIcon />
        </ListItemDecorator>
        Delete
      </ListItemButton>

      <ListItemButton onClick={handleToggleDeletionKeys}>
        <ListItemDecorator />
        Show Deletion Keys
        <Switch checked={showDeletionKeys} sx={{ ml: 'auto' }} />
      </ListItemButton>

    </OptimaDrawerList>

  </>;

}