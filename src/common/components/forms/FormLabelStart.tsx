import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormHelperText, FormLabel } from '@mui/joy';
import InfoIcon from '@mui/icons-material/Info';

import { GoodTooltip } from '~/common/components/GoodTooltip';


/**
 * Shared label part (left side)
 */
const FormLabelStartBase = (props: {
  title: React.ReactNode,
  description?: React.ReactNode,
  tooltip?: React.ReactNode,
  onClick?: (event: React.MouseEvent) => void,
  sx?: SxProps,
}) =>
  <div>
    {/* Title */}
    <FormLabel
      onClick={props.onClick}
      sx={{
        // minWidth: formLabelStartWidth,
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        ...(!!props.onClick && { cursor: 'pointer', textDecoration: 'underline' }),
        ...props.sx,
      }}
    >
      {props.title} {!!props.tooltip && (
      <GoodTooltip title={props.tooltip} arrow placement='top'>
        <InfoIcon sx={{ ml: 0.5, cursor: 'pointer', fontSize: 'md', color: 'primary.solidBg' }} />
      </GoodTooltip>
    )}
    </FormLabel>

    {/* [SubTitle] */}
    {!!props.description && (
      <FormHelperText
        sx={{
          fontSize: 'xs',
          display: 'block',
        }}
      >
        {props.description}
      </FormHelperText>
    )}
  </div>;
FormLabelStartBase.displayName = 'FormLabelStart';

export const FormLabelStart = React.memo(FormLabelStartBase);