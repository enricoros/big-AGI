import React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Step, stepClasses, StepIndicator, stepIndicatorClasses, Stepper, Typography } from '@mui/joy';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

import { ChatMessageMemo } from '../../apps/chat/components/message/ChatMessage';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { createDMessage } from '~/common/state/store-chats';
import { useIsMobile } from '~/common/components/useMatchMedia';


// Steps - the top stepper

interface ExplainerStep {
  stepDigits: string,
  stepName: string,
}

const stepSequenceSx: SxProps = {
  // width: '100%',
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
};


function AllStepsStepper(props: {
  steps: ExplainerStep[],
  activeIndex: number,
  isMobile: boolean,
}) {
  return (
    <Stepper sx={stepSequenceSx}>
      {props.steps.map(((step, stepIndex) => {
        const completed = props.activeIndex > stepIndex;
        const active = props.activeIndex === stepIndex;
        return (
          <Step
            key={'step-' + stepIndex}
            orientation='vertical'
            completed={completed}
            active={active}
            indicator={
              <StepIndicator variant={(completed || active) ? 'solid' : 'outlined'} color='primary'>
                {completed ? <CheckRoundedIcon /> : active ? <KeyboardArrowDownRoundedIcon /> : undefined}
              </StepIndicator>
            }
          >
            <Typography
              fontSize={props.isMobile ? 'sm' : undefined}
              fontWeight='xl'
              endDecorator={
                step.stepName && <Typography fontSize='sm' fontWeight='normal'>{step.stepName}</Typography>
              }
            >
              {step.stepDigits}
            </Typography>
          </Step>
        );
      }))}
    </Stepper>
  );
}


// The Explainer - Carousel of pages

export interface ExplainerPage extends ExplainerStep {
  titlePrefix?: string,
  titleSquircle?: boolean,
  titleSpark?: string,
  titleSuffix?: string,
  mdContent: string
}

export function ExplainerCarousel(props: {
  steps: ExplainerPage[],
  footer?: React.ReactNode,
  showPrevious?: boolean,
  onFinished: () => any,
}) {

  // state
  const [stepIndex, setStepIndex] = React.useState(0);

  // external state
  const isMobile = useIsMobile();

  // derived state
  const isDone = stepIndex > props.steps.length - 1;
  const activeStep = props.steps[stepIndex] ?? null;

  // handlers

  const mdText = activeStep?.mdContent ?? null;
  const mdMessage = React.useMemo(() => {
    return mdText ? createDMessage('assistant', mdText) : null;
  }, [mdText]);


  // [effect] restart from 0 if steps change
  React.useEffect(() => {
    setStepIndex(0);
  }, [props.steps]);


  return (
    <Box sx={{
      flex: 1,
      mx: 'auto',
      maxWidth: '900px', // <Container/>
      minWidth: '80%',   // ensure it's not too snug on desktop

      // content
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      gap: 'var(--Pad)',
    }}>


      {/* Page Title */}
      <Typography
        level='h1'
        component='h1'
        sx={{
          fontSize: isMobile ? '2rem' : '2.75rem',
          fontWeight: 'md',
          textAlign: 'center',
        }}>
        {activeStep?.titlePrefix}{' '}
        {!!activeStep?.titleSquircle && <AgiSquircleIcon inverted sx={{ color: 'white', fontSize: isMobile ? '1.55rem' : '2.04rem', borderRadius: 'md' }} />}
        {!!activeStep?.titleSquircle && '-'}
        {!!activeStep?.titleSpark && <Box component='span' sx={{ fontWeight: 'lg', /*animation: `${animationTextShadowLimey} 15s linear infinite`*/ color: 'primary.softColor' }}>
          {activeStep.titleSpark}
        </Box>}{activeStep?.titleSuffix}
      </Typography>


      {/* All Steps */}
      <Box>
        <AllStepsStepper
          steps={props.steps}
          activeIndex={stepIndex}
          isMobile={isMobile}
        />
      </Box>


      {/* Page Message */}
      <Box sx={{
        // display: 'grid',
        // px: 'var(--Pad)',
      }}>
        {!!mdMessage && (
          <ChatMessageMemo
            message={mdMessage}
            fitScreen={isMobile}
            showAvatar={false}
            adjustContentScaling={isMobile ? -1 : undefined}
            sx={{
              minHeight: '17rem', // 256px
              py: 2,
              border: 'none',
              bordreRadius: 0,
              borderRadius: 'xl',
              // boxShadow: '0 8px 24px -4px rgb(var(--joy-palette-primary-darkChannel) / 0.12)',
              boxShadow: '0 60px 32px -60px rgb(var(--joy-palette-primary-darkChannel) / 0.14)',
            }}
          />
        )}
      </Box>


      {/* Buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--Pad_2)' }}>
        {/* Advance Button */}
        <Button
          variant='solid'
          endDecorator={<ArrowForwardRoundedIcon />}
          onClick={() => setStepIndex(step => step < props.steps.length - 1 ? step + 1 : step)}
          sx={{
            boxShadow: '0 8px 24px -4px rgb(var(--joy-palette-primary-mainChannel) / 20%)',
            minWidth: 180,
          }}
        >
          Continue
        </Button>

        {/* Back Button */}
        <Button
          variant='outlined'
          color='neutral'
          onClick={() => setStepIndex(step => step > 0 ? step - 1 : step)}
          sx={{
            minWidth: 120,
          }}
        >
          Previous
        </Button>
      </Box>


      {/* Final words of wisdom (also perfect for centering the other components) */}
      {props.footer}

    </Box>
  );
}