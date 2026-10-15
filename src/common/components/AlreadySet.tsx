import * as React from 'react';

import { Typography } from '@mui/joy';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';


export function AlreadySet(props: { required?: boolean, overridden?: boolean }) {
  // a client value always wins over the server's (every *.access.ts reads client || server): nothing to say about the server
  if (props.overridden && !props.required)
    return null;
  return (
    <Typography level="body-xs" endDecorator={props.required ? undefined : <CheckRoundedIcon color="success" sx={{ fontSize: 'md' }} />} sx={{ display: 'block' /* not flex: keeps the text baseline aligned with the field label */ }}>
      {/*Installed Already*/}
      {props.required ? 'required' : 'Already set on server'}
    </Typography>
  );
}