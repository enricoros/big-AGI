import * as React from 'react';
import { shallow } from 'zustand/shallow';

import { Button, ListItem, ListItemDecorator } from '@mui/joy';
import AddIcon from '@mui/icons-material/Add';
import OutlineFolderIcon from '@mui/icons-material/Folder';

import { InlineTextarea } from '~/common/components/InlineTextarea';
import { useFolderStore } from '~/common/state/store-folders';


export function AddFolderButton() {

  // state
  const [isAddingFolder, setIsAddingFolder] = React.useState(false);

  const { createFolder } = useFolderStore((state) => ({
    createFolder: state.createFolder,
  }), shallow);

  const handleCreateFolder = (name: string) => {
    if (name.trim())
      createFolder(name.trim());
    setIsAddingFolder(false);
  };

  const handleCancelAddFolder = () => {
    setIsAddingFolder(false);
  };

  return isAddingFolder ? (
    <ListItem sx={{
      '--ListItem-paddingLeft': '0.75rem',
      '--ListItem-minHeight': '3rem', // --Folder-ListItem-height
      display: 'flex', alignItems: 'center', gap: 1,
    }}>
      <ListItemDecorator>
        <OutlineFolderIcon />
      </ListItemDecorator>
      <InlineTextarea
        initialText='' placeholder='Folder Name'
        onEdit={handleCreateFolder}
        onCancel={handleCancelAddFolder}
        sx={{
          flexGrow: 1,
        }} />
      {/*<IconButton color='danger' onClick={handleCancelAddFolder}>*/}
      {/*  <CloseIcon />*/}
      {/*</IconButton>*/}
    </ListItem>
  ) : (
    <Button
      color='neutral'
      variant='plain'
      startDecorator={<AddIcon />}
      onClick={() => setIsAddingFolder(true)}
      sx={{
        // display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
        // minHeight: '3rem', // --Folder-ListItem-height
        // match the forder elements
        paddingInline: '1.2rem',
        gap: '0.75rem',
        // fontWeight: 400,
      }}
    >
      New folder
    </Button>
  );
}
