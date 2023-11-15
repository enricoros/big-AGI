import * as React from 'react';

import { Box, FormHelperText, FormLabel, Tooltip } from '@mui/joy';
import { SxProps } from '@mui/joy/styles/types';

import { settingsCol1Width } from '~/common/app.theme';

/**
 * Shared label part (left side)
 */
export const FormLabelStart = (props: {
  title: string | React.JSX.Element,
  description?: string | React.JSX.Element
  tooltip?: string | React.JSX.Element,
  onClick?: () => void,
  sx?: SxProps,
}) => {

  const labelComponent = React.useMemo(() =>
      <Box>
        {/* Title */}
        <FormLabel
          onClick={props.onClick}
          sx={{
            width: settingsCol1Width,
            ...(!!props.onClick && { cursor: 'pointer', textDecoration: 'underline' }),
            ...props.sx,
          }}
        >
          {props.title}
        </FormLabel>

        {/* [SubTitle] */}
        {!!props.description && (
          <FormHelperText
            sx={{
              display: 'block',
            }}
          >
            {props.description}
          </FormHelperText>
        )}
      </Box>
    , [props.title, props.description, props.onClick, props.sx]);

  // wrap into a tooltip, if set
  return !props.tooltip
    ? labelComponent
    : <Tooltip title={props.tooltip} sx={{ maxWidth: { sm: '50vw', md: '25vw', lg: '20vw' } }}>
      {labelComponent}
    </Tooltip>;
};
