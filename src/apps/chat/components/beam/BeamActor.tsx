import * as React from 'react';

import { Sheet, styled } from '@mui/joy';

const beamClasses = {
  active: 'beam-Active',
} as const;

const BeamSheet = styled(Sheet)(({ theme }) => ({
  // --Bar is defined in InvertedBar
  // '--MarginX': '0.25rem',

  // active
  [`&.${beamClasses.active}`]: {
    // two inset shadows, one light blue and another deep blue
    boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
  },
})) as typeof Sheet;


export function BeamActor(props: { children: React.ReactNode }) {

  return (
    <BeamSheet>
      {props.children}
    </BeamSheet>
  );
}