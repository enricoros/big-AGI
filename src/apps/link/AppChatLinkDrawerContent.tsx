import * as React from 'react';
import TimeAgo from 'react-timeago';

import { Box, ListDivider, ListItem, ListItemButton, ListItemDecorator, Typography } from '@mui/joy';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

import { useChatLinkItems } from '~/modules/trade/store-module-trade';

import { Brand } from '~/common/app.config';
import { Link } from '~/common/components/Link';
import { getChatLinkRelativePath, ROUTE_INDEX } from '~/common/app.routes';
import { useOptimaDrawers } from '~/common/layout/optima/useOptimaDrawers';
import { PageDrawerList } from '~/common/layout/optima/components/PageDrawerList';


/**
 * Drawer Items are all the links already shared, for quick access.
 * This is stores in the Trade Store (local storage).
 */
export function AppChatLinkDrawerContent() {

  // external state
  const { closeDrawerOnMobile } = useOptimaDrawers();
  const chatLinkItems = useChatLinkItems()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const notEmpty = chatLinkItems.length > 0;

  return <PageDrawerList>

    {notEmpty && (
      <ListItemButton
        onClick={closeDrawerOnMobile}
        component={Link} href={ROUTE_INDEX} noLinkStyle
      >
        <ListItemDecorator><ArrowBackIcon /></ListItemDecorator>
        {Brand.Title.Base}
      </ListItemButton>
    )}

    {notEmpty && <ListDivider />}

    <ListItem>
      <Typography level='body-sm'>
        {notEmpty ? 'Links shared by you' : 'No prior shared links'}
      </Typography>
    </ListItem>

    {notEmpty && <Box sx={{ overflowY: 'auto' }}>
      {chatLinkItems.map(item => (

        <ListItemButton
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
        </ListItemButton>

      ))}
    </Box>}
  </PageDrawerList>;

}