import * as React from 'react';

import { FormHelperText, FormLabel } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';
import InfoIcon from '@mui/icons-material/Info';

import { GoodTooltip } from '~/common/components/GoodTooltip';
import { formLabelStartWidth } from '~/common/app.theme';


/**
 * Shared label part (left side)
 */
const FormLabelStartBase = (props: {
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element
  tooltip?: string | React.JSX.Element,
  onClick?: (event: React.MouseEvent) => void,
  sx?: SxProps,
}) =>
  <div>
    {/* Title */}
    <FormLabel
      onClick={props.onClick}
      sx={{
        minWidth: formLabelStartWidth,
        ...(!!props.onClick && { cursor: 'pointer', textDecoration: 'underline' }),
        ...props.sx,
      }}
    >
      {props.title} {props.tooltip && (
      <GoodTooltip title={props.tooltip}>
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