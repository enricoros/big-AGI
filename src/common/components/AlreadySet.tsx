import * as React from 'react';

import { Typography } from '@mui/joy';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';


export function AlreadySet(props: { required?: boolean }) {
  return (
    <Typography level="body-sm" endDecorator={props.required ? undefined : <CheckRoundedIcon color="success" sx={{ fontSize: 'lg' }} />}>
      {/*Installed Already*/}
      {props.required ? 'required' : 'Already set on server'}
    </Typography>
  );
}