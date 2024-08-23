import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/joy';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';

import type { AgiAttachmentPromptsData } from '~/modules/aifn/agiattachmentprompts/useAgiAttachmentPrompts';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';

import { AGI_SUGGESTIONS_COLOR } from '../textarea/ComposerTextAreaActions';


export const LLMAttachmentsPromptsButtonMemo = React.memo(LLMAttachmentsPromptsButton);


const promptGenIconButtonSx: SxProps = {
  // minWidth: 40,
  backgroundColor: 'background.level1',
  boxShadow: `inset 0 4px 6px -4px rgb(var(--joy-palette-${AGI_SUGGESTIONS_COLOR}-darkChannel) / 40%)`,
  borderRadius: '2rem',
  borderBottomLeftRadius: 0,
  // borderColor: `${AGI_SUGGESTIONS_COLOR}.outlinedBorder`,
  // '&:hover': {
  //   backgroundColor: 'background.level1',
  // },
  '&:hover': {
    backgroundColor: `${AGI_SUGGESTIONS_COLOR}.solidBg`,
    borderColor: `${AGI_SUGGESTIONS_COLOR}.solidBg`,
    color: `${AGI_SUGGESTIONS_COLOR}.solidColor`,
  },
};

const brightenSx: SxProps = {
  ...promptGenIconButtonSx,
  backgroundColor: 'background.popup',
  boxShadow: 'xs',
};

function LLMAttachmentsPromptsButton({ data }: { data: AgiAttachmentPromptsData }) {

  const tooltipTitle =
    data.error ? (data.error.message || 'Error guessing actions')
      : data.isFetching ? null
        : data.isPending ? <Box sx={{ display: 'flex', gap: 1 }}><AgiSquircleIcon inverted sx={{ color: 'white', borderRadius: '1rem' }} /> What can I do?</Box>
          : 'Give me more ideas';

  const button = (
    <IconButton
      variant={data.error ? 'soft' : data.hasData ? 'outlined' : 'soft'}
      color={data.error ? 'danger' : data.hasData ? AGI_SUGGESTIONS_COLOR : AGI_SUGGESTIONS_COLOR}
      size='sm'
      disabled={data.isFetching}
      onClick={data.refetch}
      // onClick={data.hasData ? data.clear : data.refetch}
      sx={(data.hasData && !data.isFetching) ? brightenSx : promptGenIconButtonSx}
    >
      {data.isFetching ? (
        <CircularProgress size='sm' color='neutral' />
      ) : (
        <AutoFixHighIcon fontSize='small' />
      )}
    </IconButton>
  );

  return !tooltipTitle ? button : (
    <Tooltip variant='outlined' disableInteractive placement='left' arrow title={tooltipTitle}>
      {button}
    </Tooltip>
  );
}