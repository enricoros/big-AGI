import * as React from 'react';

import { Button } from '@mui/joy';

import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import { LiveFileChooseIcon, LiveFileIcon } from './liveFile.icons';


export function LiveFileSyncButton(props: {
  fileHasContent: boolean;
  isPairingValid: boolean;
  isSavingFile: boolean;
  handleSyncButtonClicked: () => void;
}) {



  return <TooltipOutlined
    title={
      props.fileHasContent ? 'Click to reload the File and compare.'
        : props.isPairingValid ? 'Click to compare with the File contents.'
          : 'Setup LiveFile pairing.'
    }
    color={props.fileHasContent ? 'primary' : 'success'}
    variant={props.fileHasContent ? undefined : 'solid'}
  >
    <Button
      variant='soft'
      color={props.fileHasContent ? 'primary' : 'success'}
      size='sm'
      disabled={props.isSavingFile}
      onClick={props.handleSyncButtonClicked}
      startDecorator={
        props.fileHasContent ? <LiveFileIcon />
          : (props.isPairingValid ? <LiveFileIcon />
            : <LiveFileChooseIcon />)
      }
      aria-label={props.isPairingValid ? 'Sync File' : 'Choose File'}
    >
      {props.fileHasContent ? 'Refresh'
        : props.isPairingValid ? 'Sync File'
          : 'Pair File'}
    </Button>
  </TooltipOutlined>;
}