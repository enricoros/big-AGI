import * as React from 'react';
import SvgIcon, { SvgIconProps } from '@mui/joy/SvgIcon';

export function SlmIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" width="24" height="24" {...props}>
      <path
        d="M12 2L2 7l10 5 10-5-10-5zm0 7.5L4.5 7 12 3.25 19.5 7 12 9.5zM2 17l10 5 10-5M2 12l10 5 10-5"
        fill="currentColor"
        fillRule="evenodd"
      />
    </SvgIcon>
  );
}
