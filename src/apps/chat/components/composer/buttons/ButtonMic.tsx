import * as React from 'react';

import { Alert, Box, IconButton } from '@mui/joy';
import { ColorPaletteProp, VariantProp } from '@mui/joy/styles/types';
import MicIcon from '@mui/icons-material/Mic';

import { ExternalDocsLink } from '~/common/components/ExternalDocsLink';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { KeyStroke } from '~/common/components/KeyStroke';


const micLegend = (errorMessage: string | null) =>
  <Box sx={{ px: 1, py: 0.75, lineHeight: '1.5rem' }}>
    Voice input<br />
    <KeyStroke combo='Ctrl + M' sx={{ mt: 1, mb: 0.5 }} />
    {errorMessage && (
      <Alert variant='soft' color='danger' sx={{ mt: 2, mb: 0.5, flexDirection: 'column', alignItems: 'flex-start' }}>
        {errorMessage}
        <ExternalDocsLink color='danger' level='body-sm' docPage='help-feature-microphone'>
          How to fix...
        </ExternalDocsLink>
      </Alert>
    )}
  </Box>;


export const ButtonMicMemo = React.memo(ButtonMic);

function ButtonMic(props: {
  variant: VariantProp,
  color: ColorPaletteProp,
  errorMessage: string | null,
  noBackground?: boolean,
  onClick: () => void,
}) {

  // Mobile: don't blur the textarea when clicking the mic button
  const handleDontBlurTextArea = React.useCallback((event: React.MouseEvent) => {
    const isTextAreaFocused = document.activeElement?.tagName === 'TEXTAREA';
    // If a textarea is focused, prevent the default blur behavior
    if (isTextAreaFocused)
      event.preventDefault();
  }, []);

  return (
    <GoodTooltip placement='top' arrow enableInteractive title={micLegend(props.errorMessage)}>
      <IconButton variant={props.variant} color={props.color} onMouseDown={handleDontBlurTextArea} onClick={props.onClick} sx={props.noBackground ? { background: 'none' } : {}}>
        <MicIcon />
      </IconButton>
    </GoodTooltip>
  );
}