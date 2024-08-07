import * as React from 'react';

import { CircularProgress, IconButton, Tooltip } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/attachmentprompts/useAgiAttachmentPrompts';
import { SxProps } from '@mui/joy/styles/types';
import { AGI_SUGGESTIONS_COLOR } from '../textarea/ComposerTextAreaActions';


export const LLMAttachmentsPromptsButtonMemo = React.memo(LLMAttachmentsPromptsButton);


const promptGenIconButtonSx: SxProps = {
  minWidth: 40,
  backgroundColor: 'background.level1',
  boxShadow: `inset 0 4px 6px -4px rgb(var(--joy-palette-${AGI_SUGGESTIONS_COLOR}-darkChannel) / 40%)`,
  borderRadius: '2rem',
  borderBottomLeftRadius: 0,
  borderColor: `${AGI_SUGGESTIONS_COLOR}.outlinedColor`,
  // '&:hover': {
  //   backgroundColor: 'background.level1',
  // },
};

const brightenSx: SxProps = {
  ...promptGenIconButtonSx,
  backgroundColor: 'background.popup',
  boxShadow: undefined,
};

function LLMAttachmentsPromptsButton({ data }: { data: AgiAttachmentPromptsData }) {

  const tooltipTitle =
    data.error ? (data.error.message || 'Error guessing actions')
      : data.isFetching ? null
        : data.isPending ? 'What to do?'
          : 'Guess more';

  const button = (
    <IconButton
      variant={data.error ? 'soft' : data.hasData ? 'outlined' : 'soft'}
      color={data.error ? 'danger' : data.hasData ? AGI_SUGGESTIONS_COLOR : AGI_SUGGESTIONS_COLOR}
      size='sm'
      disabled={data.isFetching}
      onClick={data.refetch}
      sx={data.hasData ? brightenSx : promptGenIconButtonSx}
    >
      {data.isFetching ? (
        <CircularProgress size='sm' color='neutral' />
      ) : (
        <AutoFixHighIcon fontSize='small' />
      )}
    </IconButton>
  );

  return !tooltipTitle ? button : (
    <Tooltip variant='outlined' disableInteractive placement='top-end' arrow title={tooltipTitle}>
      {button}
    </Tooltip>
  );
}