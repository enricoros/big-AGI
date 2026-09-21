import * as React from 'react';

import type { SxProps, VariantProp } from '@mui/joy/styles/types';
import { Chip, ColorPaletteProp } from '@mui/joy';

import type { DLLMId } from '~/common/stores/llms/llms.types';


/**
 * One-line notice on a Beam card (ray, merge) or pane: a soft bordered chip, sized to its text
 * unless fullWidth. For multi-line error text use InlineError instead.
 */
export function BeamCardNotice(props: { color: ColorPaletteProp, variant?: VariantProp, fullWidth?: boolean, children: React.ReactNode }) {

  const { color, variant = 'soft', fullWidth } = props;
  const chipSx = React.useMemo((): SxProps => ({
    borderRadius: 'sm',
    ...(variant !== 'solid' && {
      border: '1px solid',
      borderColor: `${color}.outlinedBorder`,
    }),
    fontSize: 'xs',
    lineHeight: 'sm',
    gap: 0.75,
    px: 1,
    py: 0.5,
    ...(fullWidth && { maxWidth: 'none' }), // Joy caps a Chip at 'max-content'; lifted, the card's column layout stretches it
  }), [color, fullWidth, variant]);

  return (
    <Chip color={color} variant={variant} sx={chipSx}>
      <span className='agi-ellipsize'>{props.children}</span>
    </Chip>
  );
}


/**
 * Notice for a ray/merge whose selected model id no longer resolves (e.g. loaded from a saved
 * team after the model was removed). Renders nothing when the id is unset or resolves.
 */
export function BeamModelUnavailable(props: { llmId: DLLMId | null, resolved: boolean }) {
  if (!props.llmId || props.resolved)
    return null;
  return (
    <BeamCardNotice color='neutral'>
      Former model unavailable: <span style={{ opacity: 0.75 }}>{props.llmId}</span>
    </BeamCardNotice>
  );
}
