import * as React from 'react';

import { Box, Button, FormControl, IconButton, Input, Tooltip, Typography } from '@mui/joy';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';

import { buttonAttachSx } from '~/common/components/ButtonAttachFiles';


export const ButtonAttachWebMemo = React.memo(ButtonAttachWeb);

function ButtonAttachWeb(props: {
  isMobile?: boolean,
  disabled?: boolean,
  fullWidth?: boolean,
  noToolTip?: boolean,
  onAttachWeb: (url: string) => void,
}) {

  // state
  const [isOpen, setIsOpen] = React.useState(false);
  const [url, setUrl] = React.useState('');

  // derived state
  const { onAttachWeb } = props;

  const handleOpen = React.useCallback(() => {
    setIsOpen(true);
    setUrl('');
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSubmit = React.useCallback((e: React.FormEvent) => {
    e.preventDefault();

    let normalizedUrl = url;
    // noinspection HttpUrlsUsage
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://'))
      normalizedUrl = 'https://' + normalizedUrl;

    if (!asValidURL(normalizedUrl)) {
      // noinspection HttpUrlsUsage
      addSnackbar({
        key: 'invalid-url',
        message: 'Please enter a valid web address',
        type: 'issue',
        overrides: { autoHideDuration: 2000 },
      });
      return;
    }

    onAttachWeb(normalizedUrl);
    handleClose();
  }, [handleClose, onAttachWeb, url]);

  const button = props.isMobile ? (
    <IconButton disabled={props.disabled} onClick={handleOpen}>
      <LanguageRoundedIcon />
    </IconButton>
  ) : (
    <Button
      variant='plain'
      color='neutral'
      disabled={props.disabled}
      fullWidth={props.fullWidth}
      startDecorator={<LanguageRoundedIcon />}
      onClick={handleOpen}
      sx={buttonAttachSx.desktop}
    >
      Web
    </Button>
  );

  return <>

    {/* Button with optional tooltip */}
    {props.noToolTip ? button : (
      <Tooltip arrow disableInteractive placement='top-start' title={(
        <Box sx={buttonAttachSx.tooltip}>
          <b>Add Web Content 🌐</b><br />
          Import from websites and YouTube
        </Box>
      )}>
        {button}
      </Tooltip>
    )}

    {/* URL Input Modal */}
    <GoodModal
      open={isOpen}
      onClose={handleClose}
      title='Add Web Content'
      titleStartDecorator={<LanguageRoundedIcon />}
      closeText={'Cancel'}
      hideBottomClose
    >
      <Box fontSize='sm'>
        Enter or paste a web page address to import its content.
      </Box>
      <Typography level='body-sm'>
        Works on most websites and for YouTube videos (e.g., youtube.com/...) the transcript will be imported.
      </Typography>

      <form onSubmit={handleSubmit}>
        <FormControl>
          {/*<FormLabel>Web Address</FormLabel>*/}
          <Input
            autoFocus
            required
            placeholder='https://...'
            value={url}
            onChange={event => setUrl(event.target.value)}
            endDecorator={url.includes('youtube.com') ? <YouTubeIcon sx={{ color: 'red' }} /> : undefined}
          />
        </FormControl>
      </form>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>

        {/*<Button*/}
        {/*  aria-label='Close Dialog'*/}
        {/*  variant='soft'*/}
        {/*  color='neutral'*/}
        {/*  onClick={handleClose}*/}
        {/*  sx={{ minWidth: 100 }}*/}
        {/*>*/}
        {/*  Cancel*/}
        {/*</Button>*/}

        <Button
          variant='solid'
          type='submit'
          disabled={!url.trim()}
          onClick={handleSubmit}
          sx={{ minWidth: 160 }}
        >
          Add
        </Button>

      </Box>

    </GoodModal>

  </>;
}
