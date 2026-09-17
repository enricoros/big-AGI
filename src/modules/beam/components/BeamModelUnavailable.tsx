import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Chip } from '@mui/joy';

import type { DLLMId } from '~/common/stores/llms/llms.types';


// configuration
const COLOR = 'neutral' as const;


const _chipSx: SxProps = {
  borderRadius: 'sm',
  border: '1px solid',
  borderColor: `${COLOR}.outlinedBorder`,
  fontSize: 'xs',
  lineHeight: 'sm',
  gap: 0.75,
  px: 1,
  py: 0.5,
} as const;


/**
 * Notice for a ray/merge whose selected model id no longer resolves (e.g. loaded from a saved
 * team after the model was removed). Renders nothing when the id is unset or resolves.
 */
export function BeamModelUnavailable(props: { llmId: DLLMId | null, resolved: boolean }) {
  if (!props.llmId || props.resolved)
    return null;
  return (
    <Chip color={COLOR} variant='soft' sx={_chipSx}>
      <span className='agi-ellipsize'>Former model unavailable: <span style={{ opacity: 0.75 }}>{props.llmId}</span></span>
    </Chip>
  );
}
