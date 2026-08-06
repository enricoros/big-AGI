import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { FormHelperText, FormLabel } from '@mui/joy';
import InfoIcon from '@mui/icons-material/Info';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';


const _styles = {
  label: {
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
  } as const,
  labelClickable: {
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    textDecoration: 'underline',
  } as const,
} as const;


/**
 * Shared label part (left side)
 */
export const FormLabelStart = React.memo(function FormLabelStartBase(props: {
  title: React.ReactNode,
  description?: React.ReactNode,
  tooltip?: React.ReactNode,
  tooltipWarning?: boolean,
  onClick?: (event: React.MouseEvent) => void,
  sx?: SxProps,
}) {
  return <div>
    {/* Title */}
    <FormLabel
      onClick={props.onClick}
      sx={props.onClick ? _styles.labelClickable
        : props.sx ? { ..._styles.label, ...props.sx }
          : _styles.label
      }
    >
      {props.title} {!!props.tooltip && (
      <GoodTooltip title={props.tooltip} arrow placement='top'>
        {props.tooltipWarning
          ? <WarningRoundedIcon sx={{ ml: 0.5, cursor: 'pointer', fontSize: 'md', color: 'red' }} />
          : <InfoIcon sx={{ ml: 0.5, cursor: 'pointer', fontSize: 'md', color: 'primary.solidBg' }} />
        }
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
});
