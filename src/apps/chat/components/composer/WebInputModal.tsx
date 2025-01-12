import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';

import { Box, Button, FormControl, FormHelperText, Input, Typography } from '@mui/joy';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { asValidURL } from '~/common/util/urlUtils';


type WebInputModalInputs = {
  url: string,
}

function WebInputModal(props: {
  onClose: () => void,
  onURLSubmit: (url: string) => void,
}) {

  // state
  const { control: formControl, handleSubmit: formHandleSubmit, formState: { isValid: formIsValid } } = useForm<WebInputModalInputs>({
    values: { url: '' },
    mode: 'onChange', // validate on change
  });

  // handlers

  const { onClose, onURLSubmit } = props;

  const handleClose = React.useCallback(() => onClose(), [onClose]);

  const handleSubmit = React.useCallback(({ url }: WebInputModalInputs) => {

    let normalizedUrl = (url || '').trim();
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

    onURLSubmit(normalizedUrl);
    handleClose();
  }, [handleClose, onURLSubmit]);


  return (
    <GoodModal
      open
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

      <form onSubmit={formHandleSubmit(handleSubmit)}>

        <Controller
          control={formControl}
          name='url'
          rules={{ required: 'Please enter a valid URL' }}
          render={({ field: { value, onChange }, fieldState: { error } }) => (
            <FormControl error={!!error}>
              <Input
                autoFocus
                required
                placeholder='https://...'
                endDecorator={extractYoutubeVideoIDFromURL(value) ? <YouTubeIcon sx={{ color: 'red' }} /> : undefined}
                value={value}
                onChange={onChange}
              />
              {error && <FormHelperText>{error.message}</FormHelperText>}
            </FormControl>
          )} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2.5 }}>

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
            disabled={!formIsValid}
            sx={{ minWidth: 160 }}
          >
            Add
          </Button>

        </Box>
      </form>

    </GoodModal>
  );
}


export function useWebInputModal(onAttachWeb: (url: string) => void) {

  // state
  const [open, setOpen] = React.useState(false);

  const openWebInputDialog = React.useCallback(() => setOpen(true), []);

  const webInputDialogComponent = React.useMemo(() => open && (
    <WebInputModal
      onClose={() => setOpen(false)}
      onURLSubmit={onAttachWeb}
    />
  ), [onAttachWeb, open]);

  return {
    openWebInputDialog,
    webInputDialogComponent,
  };
}