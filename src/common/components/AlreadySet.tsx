import * as React from 'react';

import { Typography } from '@mui/joy';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';


export function AlreadySet(props: { required?: boolean }) {
  return (
    <Typography level='body-sm' startDecorator={props.required ? undefined : <CheckRoundedIcon color='success' />}>
      {/*Installed Already*/}
      {props.required ? 'required' : 'Already set on server'}
    </Typography>
  );
}