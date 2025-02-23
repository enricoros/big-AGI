import * as React from 'react';

import { Box, Button } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import { composerTextAreaSx } from './ComposerTextAreaActions';
import { imaginePromptFromTextOrThrow } from '~/modules/aifn/imagine/imaginePromptFromText';


const _style = {
  enhance: {
    minWidth: 170,
    mx: 0.625,
    pr: 2,
    border: '1px solid',
    borderColor: 'warning.outlinedBorder',
    boxShadow: '0px 4px 4px -4px rgb(var(--joy-palette-warning-darkChannel) / 20%)',
    transition: 'background-color 0.14s',
    justifyContent: 'space-between',
  } as const,
  gone: {
    visibility: 'hidden',
  } as const,
} as const;

export function ComposerTextAreaDrawActions(props: {
  composerText: string,
  onReplaceText: (text: string) => void,
}) {

  // state
  const [isSimpleEnhancing, setIsSimpleEnhancing] = React.useState(false);


  // derived
  const trimmedPrompt = props.composerText.trim();
  const userHasText = trimmedPrompt.length >= 3;


  const { onReplaceText } = props;

  const handleSimpleEnhance = React.useCallback(async () => {
    if (!trimmedPrompt || isSimpleEnhancing) return;
    setIsSimpleEnhancing(true);
    const improvedPrompt = await imaginePromptFromTextOrThrow(trimmedPrompt, 'DEV')
      .catch(console.error);
    if (improvedPrompt)
      onReplaceText(improvedPrompt);
    setIsSimpleEnhancing(false);
  }, [isSimpleEnhancing, onReplaceText, trimmedPrompt]);


  return (
    <Box sx={composerTextAreaSx}>

      {/* Enhance button */}
      <Box sx={{ ml: 'auto' }}>
        <Button
          size='sm'
          variant={isSimpleEnhancing ? 'soft' : 'soft'}
          color='warning'
          disabled={!userHasText}
          loading={isSimpleEnhancing}
          loadingPosition='end'
          // className={promptButtonClass}
          endDecorator={<AutoFixHighIcon sx={{ fontSize: '20px' }} />}
          onClick={handleSimpleEnhance}
          sx={!userHasText ? _style.gone : _style.enhance}
        >
          {isSimpleEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
        </Button>
      </Box>

    </Box>
  );
}
