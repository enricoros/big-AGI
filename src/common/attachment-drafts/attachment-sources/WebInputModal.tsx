import * as React from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';

import { Box, Button, Chip, FormControl, FormHelperText, IconButton, Input, Stack, Typography } from '@mui/joy';
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AddIcon from '@mui/icons-material/Add';
import BrowserUpdatedOutlinedIcon from '@mui/icons-material/BrowserUpdatedOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { extractYoutubeVideoIDFromURL } from '~/modules/youtube/youtube.utils';

import { GoodModal } from '~/common/components/modals/GoodModal';
import { addSnackbar } from '~/common/components/snackbar/useSnackbarsStore';
import { asValidURL, extractUrlsFromText } from '~/common/util/urlUtils';


// configuration
const MAX_URLS = 5;

type WebInputData = {
  url: string,
  // attachImages?: boolean,
}

type WebInputModalInputs = {
  links: WebInputData[];
}

const _styles = {

  ytIcon: {
    color: 'red',
  } as const,

  chipLink: {
    ml: 'auto',
    pr: 1.125,
    // '--Chip-radius': '4px',
    // whiteSpace: 'break-spaces',
    // gap: 1.5,
  } as const,

} as const;


function WebInputModal(props: {
  composerText?: string,
  onClose: () => void,
  onWebLinks: (urls: WebInputData[]) => void,
}) {

  // state
  const { control: formControl, handleSubmit: formHandleSubmit, formState: { isValid: formIsValid, isDirty: formIsDirty } } = useForm<WebInputModalInputs>({
    values: { links: [{ url: '' }] },
    mode: 'onChange', // validate on change
  });
  const { fields: formFields, append: formFieldsAppend, remove: formFieldsRemove, update: formFieldsUpdate } = useFieldArray({ control: formControl, name: 'links' });
  const firstInputRef = React.useRef<HTMLInputElement>(null);

  // derived
  const urlFieldCount = formFields.length;
  const canAddMoreUrls = urlFieldCount < MAX_URLS;

  // [effect] auto-focus first input
  React.useEffect(() => {
    setTimeout(() => {
      if (firstInputRef.current)
        firstInputRef.current.focus();
    }, 0);
  }, []);


  // memos

  const extractedComposerUrls = React.useMemo(() => {
    return !props.composerText ? null : extractUrlsFromText(props.composerText);
  }, [props.composerText]);

  const extractedUrlsCount = extractedComposerUrls?.length ?? 0;

  // handlers

  const { onClose, onWebLinks } = props;

  const handleClose = React.useCallback(() => onClose(), [onClose]);

  const handleSubmit = React.useCallback(({ links }: WebInputModalInputs) => {
    // clean and prefix URLs
    const cleanUrls = links.reduce((acc, { url, ...linkRest }) => {
      const trimmed = (url || '').trim();
      if (trimmed) {
        // this form uses a 'relaxed' URL validation, meaning one can write 'big-agi.com' and we'll assume https://
        const relaxedUrl = asValidURL(trimmed, true);
        if (relaxedUrl)
          acc.push({ url: relaxedUrl, ...linkRest });
      }
      return acc;
    }, [] as WebInputData[]);
    if (!cleanUrls.length) {
      addSnackbar({ key: 'invalid-urls', message: 'Please enter at least one valid web address', type: 'issue', overrides: { autoHideDuration: 2000 } });
      return;
    }
    onWebLinks(cleanUrls);
    handleClose();
  }, [handleClose, onWebLinks]);


  // const handleAddUrl = React.useCallback((newUrl: string) => {
  //   // bail if can't add
  //   if (!canAddMoreUrls)
  //     return addSnackbar({ key: 'max-urls', message: `Maximum ${MAX_URLS} URLs allowed`, type: 'precondition-fail' });
  //
  //   // bail if already in
  //   const exists = formFields.some(({ url }) => url === newUrl);
  //   if (exists)
  //     return addSnackbar({ key: 'duplicate-url', message: 'URL already added', type: 'info' });
  //
  //   // replace the first empty field, or append
  //   const emptyFieldIndex = formFields.findIndex(field => !field.url.trim());
  //   if (emptyFieldIndex >= 0)
  //     formFieldsUpdate(emptyFieldIndex, { url: newUrl });
  //   else
  //     formFieldsAppend({ url: newUrl });
  // }, [canAddMoreUrls, formFields, formFieldsAppend, formFieldsUpdate]);


  const handleAddAllUrls = React.useCallback(() => {
    if (!extractedComposerUrls) return;

    // new URLs that are not already in the form
    const newURLs = extractedComposerUrls.filter(url => !formFields.some(field => field.url.trim() === url));
    if (!newURLs.length) return;

    // find empty fields first
    for (let i = 0; i < formFields.length; i++) {
      const field = formFields[i];
      if (!field.url.trim()) {
        formFieldsUpdate(i, { url: newURLs.shift()! });
        if (!newURLs.length) break;
      }
    }

    // append remaining
    newURLs.forEach(url => formFieldsAppend({ url }));
  }, [extractedComposerUrls, formFields, formFieldsAppend, formFieldsUpdate]);


  return (
    <GoodModal
      open
      onClose={handleClose}
      title='Add Web Content'
      titleStartDecorator={<LanguageRoundedIcon />}
      closeText={'Cancel'}
      // unfilterBackdrop
      // themedColor='neutral'
      hideBottomClose
    >
      <Box fontSize='md'>
        Enter web page addresses to import their content.
      </Box>
      <Typography level='body-sm'>
        Works on most websites and for YouTube videos (e.g., youtube.com/...) the transcript will be imported.
        {/*You can add up to {MAX_URLS} URLs.*/}
      </Typography>


      {/* Modified URLs section */}
      {!!extractedUrlsCount && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography level='title-sm' startDecorator={<BrowserUpdatedOutlinedIcon />}>
            {extractedUrlsCount} URL{extractedUrlsCount > 1 ? 's' : ''} in your message
            {/*{extractedUrlsCount} URL{extractedUrlsCount > 1 ? 's' : ''} found in your message*/}
          </Typography>
          <Chip
            variant='soft'
            onClick={handleAddAllUrls}
            startDecorator={<AddCircleOutlineRoundedIcon />}
            sx={_styles.chipLink}
          >
            Add
          </Chip>
        </Box>
      )}


      <form onSubmit={formHandleSubmit(handleSubmit)}>
        <Stack spacing={1}>
          {formFields.map((field, index) => (
            <Controller
              key={field.id}
              control={formControl}
              name={`links.${index}.url`}
              rules={{ required: 'Please enter a valid URL' }}
              render={({ field: { value, onChange }, fieldState: { error } }) => (
                <FormControl error={!!error}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Input
                      required={index === 0}
                      placeholder='https://...'
                      endDecorator={extractYoutubeVideoIDFromURL(value) ? <YouTubeIcon sx={_styles.ytIcon} /> : undefined}
                      value={value}
                      onChange={onChange}
                      slotProps={index !== 0 ? undefined : {
                        input: {
                          ref: firstInputRef,
                        },
                      }}
                      sx={{ flex: 1 }}
                    />
                    {urlFieldCount > 1 && (
                      <IconButton
                        size='sm'
                        variant='plain'
                        color='neutral'
                        onClick={() => formFieldsRemove(index)}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    )}
                  </Box>
                  {error && <FormHelperText>{error.message}</FormHelperText>}
                </FormControl>
              )}
            />
          ))}
        </Stack>

        {/* Add a new link */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 2.5 }}>

          {formIsDirty && <Button
            color='neutral'
            variant='soft'
            disabled={!canAddMoreUrls}
            onClick={() => formFieldsAppend({ url: '' })}
            startDecorator={<AddIcon />}
          >
            Another
            {/*{urlFieldCount >= MAX_URLS ? 'Enough URLs' : urlFieldCount === 1 ? 'Add URL' : urlFieldCount === 2 ? 'Add another' : urlFieldCount === 3 ? 'And another one' : urlFieldCount === 4 ? 'Why stopping' : 'Just one more'}*/}
          </Button>}

          <Button
            variant='solid'
            type='submit'
            disabled={!formIsValid || !formIsDirty}
            sx={{ minWidth: 160, ml: 'auto' }}
          >
            Import {urlFieldCount > 1 ? `(${urlFieldCount})` : ''}
          </Button>

        </Box>
      </form>

    </GoodModal>
  );
}


export function useWebInputModal(onAttachWebLinks: (urls: WebInputData[]) => void, composerText?: string) {

  // state
  const [open, setOpen] = React.useState(false);
  const composerTextRef = React.useRef(composerText);

  // copy the text to a ref, constantly - we just care about a recent snapshot, but don't want to invalidate hooks
  composerTextRef.current = composerText;

  const openWebInputDialog = React.useCallback(() => setOpen(true), []);

  const webInputDialogComponent = React.useMemo(() => open && (
    <WebInputModal
      composerText={composerTextRef.current}
      onClose={() => setOpen(false)}
      onWebLinks={onAttachWebLinks}
    />
  ), [onAttachWebLinks, open]);

  return {
    openWebInputDialog,
    webInputDialogComponent,
  };
}