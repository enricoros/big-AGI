import React from 'react';
import { sendGAEvent } from '@next/third-parties/google';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Step, stepClasses, StepIndicator, stepIndicatorClasses, Stepper, Typography } from '@mui/joy';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

import { BlocksRenderer } from '~/modules/blocks/BlocksRenderer';

import { AgiSquircleIcon } from '~/common/components/icons/AgiSquircleIcon';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { GlobalShortcutDefinition, ShortcutKeyName, useGlobalShortcuts } from '~/common/components/useGlobalShortcuts';
import { hasGoogleAnalytics } from '~/common/components/GoogleAnalytics';
import { useIsMobile } from '~/common/components/useMatchMedia';
import { animationTextShadowLimey } from '~/common/util/animUtils';


// configuration
const colorButtons = 'neutral' as const;
const colorStepper = 'neutral' as const;


// Steps - the top stepper

interface ExplainerStep {
  stepDigits: string,
  stepName: string,
}

const stepSequenceSx: SxProps = {
  // width: '100%',
  [`& .${stepClasses.completed}::after`]: {
    bgcolor: `${colorStepper}.500`,
  },
  [`& .${stepClasses.active} .${stepIndicatorClasses.root}`]: {
    borderColor: `${colorStepper}.500`,
  },
  [`& .${stepClasses.root}:has(+ .${stepClasses.active})::after`]: {
    color: `${colorStepper}.500`,
    backgroundColor: 'transparent',
    backgroundImage: 'radial-gradient(currentColor 2px, transparent 2px)',
    backgroundSize: '7px 7px',
    backgroundPosition: 'center left',
  },
};

const buttonBaseSx: SxProps = {
  justifyContent: 'space-between',
  minHeight: '2.5rem',
  minWidth: 120,
};

const buttonNextSx: SxProps = {
  ...buttonBaseSx,
  boxShadow: `0 8px 24px -4px rgb(var(--joy-palette-${colorButtons}-mainChannel) / 20%)`,
  minWidth: 180,
};


function AllStepsStepper(props: {
  steps: ExplainerStep[],
  activeIndex: number,
  isMobile: boolean,
  onStepClicked: (stepIndex: number) => void,
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
              <StepIndicator
                variant={(completed || active) ? 'solid' : 'outlined'}
                color={colorStepper}
                onClick={() => props.onStepClicked(stepIndex)}
                sx={{ cursor: 'pointer' }}
              >
                {completed ? <CheckRoundedIcon sx={{ fontSize: 'md' }} /> : active ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 'lg' }} /> : undefined}
              </StepIndicator>
            }
          >
            <Typography
              fontSize={props.isMobile ? 'sm' : undefined}
              fontWeight='xl'
              endDecorator={
                step.stepName && <Typography fontSize='sm' fontWeight='normal' sx={{ mr: 0.5 }}>{step.stepName}</Typography>
              }
            >{step.stepDigits ?? null}</Typography>
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
  explainerId: string,
  steps: ExplainerPage[],
  footer?: React.ReactNode,
  noStepper?: boolean,
  onFinished: () => any,
}) {

  // state
  const [stepIndex, setStepIndex] = React.useState(0);

  // external state
  const isMobile = useIsMobile();

  // derived state
  const { onFinished } = props;
  const isFirstPage = stepIndex === 0;
  const isLastPage = stepIndex === props.steps.length - 1;
  const activeStep = props.steps[stepIndex] ?? null;

  // handlers

  const mdText = activeStep?.mdContent ?? null;

  const handlePrevPage = React.useCallback(() => {
    setStepIndex(step => step > 0 ? step - 1 : step);
  }, []);

  const handleNextPage = React.useCallback(() => {
    if (isLastPage) {
      hasGoogleAnalytics && sendGAEvent('event', 'tutorial_complete', { tutorial_id: props.explainerId });
      onFinished();
    } else
      setStepIndex(step => step < props.steps.length - 1 ? step + 1 : step);
  }, [isLastPage, onFinished, props.explainerId, props.steps.length]);

  React.useEffect(() => {
    const recordTutorialBegun = () => {
      hasGoogleAnalytics && sendGAEvent('event', 'tutorial_begin', { tutorial_id: props.explainerId });
    };

    const timeoutId = setTimeout(recordTutorialBegun, 500);
    return () => clearTimeout(timeoutId);
  }, [props.explainerId]);


  const shortcuts = React.useMemo((): GlobalShortcutDefinition[] => [
    [ShortcutKeyName.Left, false, false, false, handlePrevPage],
    [ShortcutKeyName.Right, false, false, false, handleNextPage],
  ], [handleNextPage, handlePrevPage]);
  useGlobalShortcuts(shortcuts);


  // [effect] restart from 0 if steps change
  // React.useEffect(() => {
  //   setStepIndex(0);
  // }, [props.steps]);


  return (
    <Box sx={{
      flex: 1,
      mx: 'auto',
      width: { sm: '92%', md: '86%' }, /* Default to 80% width */
      maxWidth: '820px',    /* But don't go over 900px */

      // content
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-evenly',
      gap: 2,
    }}>


      {/* Page Title */}
      <Typography
        level='h1'
        component='h1'
        sx={{
          fontSize: isMobile ? '2rem' : '2.5rem',
          fontWeight: 'md',
          textAlign: 'center',
          whiteSpace: 'balance',
        }}>
        {activeStep?.titlePrefix}{' '}
        {!!activeStep?.titleSquircle && <AgiSquircleIcon inverted sx={{ color: 'white', fontSize: isMobile ? '1.55rem' : '2.04rem', borderRadius: 'md' }} />}
        {!!activeStep?.titleSquircle && '-'}
        {!!activeStep?.titleSpark && <Box component='span' sx={{
          fontWeight: 'lg',
          color: 'neutral.softColor',
          animation: `${animationTextShadowLimey} 5s infinite`,
          /*, animation: `${animationTextShadowLimey} 15s linear infinite`*/
        }}>
          {activeStep.titleSpark}
        </Box>}{activeStep?.titleSuffix}
      </Typography>


      {/* Page Message */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>

        {/* Main Card with the markdown body */}
        {!!mdText && (
          <Box sx={{
            minHeight: '24rem',
            backgroundColor: 'background.popup',
            borderRadius: 'lg',
            boxShadow: '0 60px 32px -60px rgb(var(--joy-palette-primary-darkChannel) / 0.14)',
            mb: 2,
            px: { xs: 1, md: 2 },
            py: 2,

            // customize the embedded GitHub Markdown for transparent images
            ['.markdown-body img']: {
              '--color-canvas-default': 'transparent!important',
            },
          }}>
            <BlocksRenderer
              text={mdText}
              fromRole='assistant'
              contentScaling='md'
              fitScreen={isMobile}
              renderTextAsMarkdown
            />
          </Box>
        )}

        {/* Advance Button */}
        <Button
          variant='solid'
          color={colorButtons}
          onClick={handleNextPage}
          endDecorator={isLastPage ? <ChatBeamIcon /> : <ArrowForwardRoundedIcon />}
          sx={buttonNextSx}
        >
          {isLastPage ? 'Start' : 'Next'}
        </Button>

        {/* Back Button */}
        <Button
          variant='plain'
          color={colorButtons}
          disabled={isFirstPage}
          onClick={handlePrevPage}
          startDecorator={<ArrowBackRoundedIcon />}
          sx={buttonBaseSx}
        >
          Previous
        </Button>

      </Box>


      {/* All Steps */}
      {props.noStepper ? null : (
        <AllStepsStepper
          steps={props.steps}
          activeIndex={stepIndex}
          isMobile={isMobile}
          onStepClicked={setStepIndex}
        />
      )}


      {/* Final words of wisdom (also perfect for centering the other components) */}
      {props.footer}

    </Box>
  );
}