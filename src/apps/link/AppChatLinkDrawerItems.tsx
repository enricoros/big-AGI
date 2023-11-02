import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, ListDivider, ListItem, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useChatLinkItems } from '../chat/trade/store-sharing';

import { Brand } from '~/common/brand';
import { Link } from '~/common/components/Link';
import { closeLayoutDrawer } from '~/common/layout/store-applayout';
import { getChatLinkRelativePath, getHomeLink } from '~/common/routes';


/**
 * Drawer Items are all the links already shared, for quick access.
 * This is stores in the Trade Store (local storage).
 */
export function AppChatLinkDrawerItems() {

  // external state
  const chatLinkItems = useChatLinkItems()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notEmpty = chatLinkItems.length > 0;

  return <>

    <MenuItem
      onClick={closeLayoutDrawer}
      component={Link} href={getHomeLink()} noLinkStyle
    >
      <ListItemDecorator><ArrowBackIcon /></ListItemDecorator>
      {Brand.Title.Base}
    </MenuItem>

    {notEmpty && <ListDivider />}

    {notEmpty && <ListItem>
      <Typography level='body-sm'>
        Links shared by you
      </Typography>
    </ListItem>}

    {notEmpty && <Box sx={{ overflowY: 'auto' }}>
      {chatLinkItems.map(item => (

        <MenuItem
          key={'chat-link-' + item.objectId}
          component={Link} href={getChatLinkRelativePath(item.objectId)} noLinkStyle
          sx={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Typography level='title-sm'>
            {item.chatTitle || 'Untitled Chat'}
          </Typography>
          <Typography level='body-xs'>
            <TimeAgo date={item.createdAt} />
          </Typography>
        </MenuItem>

      ))}
    </Box>}
  </>;

}