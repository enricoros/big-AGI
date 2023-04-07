import * as React from 'react';

import { IconButton, ListItem, ListItemDecorator, Menu, MenuItem, Typography } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

import { Link } from '@/components/util/Link';
import { SystemPurposeId, SystemPurposes } from '@/lib/data';
import { useChatStore, useConversationNames } from '@/lib/store-chats';


/**
 * FIXME - TEMPORARY - placeholder for a proper Pages Drawer
 */
export function PagesMenu(props: { pagesMenuAnchor: HTMLElement | null, onClose: () => void, onClearConversation: (e: React.MouseEvent, conversationId: string) => void }) {

  // external state
  const setActiveConversation = useChatStore(state => state.setActiveConversationId);
  const conversationNames: { id: string; name: string, systemPurposeId: SystemPurposeId }[] = useConversationNames();

  const handleConversationClicked = (conversationId: string) => setActiveConversation(conversationId);

  return <Menu
    variant='plain' color='neutral' size='lg' placement='bottom-start' sx={{ minWidth: 280 }}
    open={!!props.pagesMenuAnchor} anchorEl={props.pagesMenuAnchor} onClose={props.onClose}
    disablePortal={false}>

    <ListItem>
      <Typography level='body2'>
        Active chats
      </Typography>
    </ListItem>

    {conversationNames.map((conversation) => (
      <MenuItem
        key={'c-id-' + conversation.id}
        onClick={() => handleConversationClicked(conversation.id)}
      >

        <ListItemDecorator>
          {SystemPurposes[conversation.systemPurposeId]?.symbol || ''}
        </ListItemDecorator>

        <Typography sx={{ mr: 2 }}>
          {conversation.name}
        </Typography>

        <IconButton
          variant='soft' color='neutral' sx={{ ml: 'auto' }}
          onClick={e => props.onClearConversation(e, conversation.id)}>
          <DeleteOutlineIcon />
        </IconButton>

      </MenuItem>
    ))}

    <MenuItem disabled={true}>
      <ListItemDecorator><AddIcon /></ListItemDecorator>
      <Typography sx={{ opacity: 0.5 }}>
        New chat (soon)
        {/* We need stable Chat and Message IDs, and one final review to the data structure of Conversation for future-proofing */}
      </Typography>
    </MenuItem>


    <ListItem>
      <Typography level='body2'>
        Scratchpad
      </Typography>
    </ListItem>

    <MenuItem>
      <ListItemDecorator />
      <Typography sx={{ opacity: 0.5 }}>
        Feature <Link href='https://github.com/enricoros/nextjs-chatgpt-app/issues/17' target='_blank'>#17</Link>
      </Typography>
    </MenuItem>

  </Menu>;
}