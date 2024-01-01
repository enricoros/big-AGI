import * as React from 'react';

import Sheet, { sheetClasses } from '@mui/joy/Sheet';
import Typography from '@mui/joy/Typography';

import { DFolder, useFolderStore } from '~/common/state/store-folders';
import { DConversation } from '~/common/state/store-chats';

export function ChatFolderList() {
  return (
    <Sheet variant="soft" sx={{ width: 343, p: 2, borderRadius: 'sm' }}>
      <Typography level="h3" fontSize="xl" fontWeight="xl" mb={1}>
        Folders
      </Typography>
      
    </Sheet>
  );
}


