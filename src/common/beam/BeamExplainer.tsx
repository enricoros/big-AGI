import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Sheet, Step, stepClasses, StepIndicator, stepIndicatorClasses, Stepper, Typography } from '@mui/joy';
import { animationEnterScaleUp, animationTextShadowLimey } from '~/common/util/animUtils';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';


const beamSteps: { number: string, name: string, value: number }[] = [
  { number: '01', name: 'Beam', value: 0 },
  { number: '02', name: 'Merge', value: 1 },
  { number: '03', name: 'Tips', value: 2 },
] as const;

function BeamSteps(props: { value: number }) {
  return (
    <Stepper
      sx={{
        width: '100%',
        [`& .${stepClasses.completed}::after`]: {
          bgcolor: 'primary.500',
        },
        [`& .${stepClasses.active} .${stepIndicatorClasses.root}`]: {
          borderColor: 'primary.500',
        },
        [`& .${stepClasses.root}:has(+ .${stepClasses.active})::after`]: {
          color: 'primary.500',
          backgroundColor: 'transparent',
          backgroundImage: 'radial-gradient(currentColor 2px, transparent 2px)',
          backgroundSize: '7px 7px',
          backgroundPosition: 'center left',
        },
      }}
    >
      {beamSteps.map(step => {
        const completed = props.value > step.value;
        const active = props.value === step.value;
        return (
          <Step
            key={'step-' + step.value}
            orientation='vertical'
            completed={completed}
            active={active}
            indicator={
              <StepIndicator variant={completed ? 'solid' : 'outlined'} color='primary'>
                {completed ? <CheckRoundedIcon /> : active ? <KeyboardArrowDownRoundedIcon /> : undefined}
              </StepIndicator>
            }
          >
            <Typography
              fontWeight='xl'
              endDecorator={
                <Typography fontSize='sm' fontWeight='normal'>{step.name}</Typography>
              }
            >
              {step.number}
            </Typography>
          </Step>
        );
      })}
    </Stepper>
  );
}


export function BeamExplainer(props: {
  onWizardComplete: () => any,
  sx?: SxProps,
}) {
  const grayUI = true;
  return (
    <Sheet
      // variant={grayUI ? 'solid' : 'soft'}
      // invertedColors={grayUI ? true : undefined}
      sx={{
        '--Pad': { xs: '1rem', md: '1.5rem', xl: '1.5rem' },
        '--Pad_2': 'calc(var(--Pad) / 2)',

        // enter animation
        animation: `${animationEnterScaleUp} 0.2s cubic-bezier(.17,.84,.44,1)`,

        // scrollable layout
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--Pad)',
        padding: 'var(--Pad)',

        ...props.sx,
      }}>


      <Typography level='h1' component='h1' sx={{ fontSize: '3rem', fontWeight: 'md', textAlign: 'center' }}>
        Let&apos;s <Box component='span' sx={{ fontWeight: 'lg', animation: `${animationTextShadowLimey} 15s linear infinite` }}>
          Beam
        </Box>
      </Typography>


      <Box sx={{ mt: 'auto' }}>
        <BeamSteps value={0} />
      </Box>

    </Sheet>

  );
}