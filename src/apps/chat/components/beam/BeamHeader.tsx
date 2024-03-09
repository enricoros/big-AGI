import * as React from 'react';

import { Box, Button, ButtonGroup, FormControl, Sheet, Typography } from '@mui/joy';
import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


export function BeamHeader(props: {
  isMobile: boolean,
  beamCount: number,
  setBeamCount: (n: number) => void,
  llmSelectComponent: React.ReactNode,
  onStart: () => void,
  // onClose: () => void,
}) {

  return (
    <Sheet
      variant='outlined'
      sx={{
        // style
        // borderRadius: 'lg',
        // boxShadow: 'xs',
        // m: 'var(--Pad_2)',
        p: 'var(--Pad)',

        // layout: max 2 cols (/3 with gap) of min 200px per col
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
        gridAutoFlow: 'row dense',
        gap: 'var(--Pad_2)',

        // '& > *': { border: '2px solid red' },
      }}
    >

      {/* Title */}
      <Box sx={{ display: 'flex', gap: 'var(--Pad_2)' }}>
        {/*<Typography level='h4'>*/}
        {/*  <ChatBeamIcon sx={{ animation: `${cssRainbowColorKeyframes} 2s linear 2.66` }} />*/}
        {/*</Typography>*/}
        <div>
          <Typography level='h4' component='h2'>
            {/*big-AGI · */}
            Beam
          </Typography>

          <Typography level='body-md'>
            Combine the smarts of models
          </Typography>
        </div>
      </Box>

      {/* LLM cell */}
      <Box sx={{ display: 'flex', gap: 'calc(var(--Pad) / 2)', alignItems: 'center', justifyContent: props.isMobile ? undefined : 'center' }}>
        {props.llmSelectComponent}
        {/*<Button variant='solid' color='neutral' onClick={handleClose}>*/}
        {/*  Close*/}
        {/*</Button>*/}
      </Box>

      {/* Count and Start cell */}
      <Box sx={{
        // gridColumn: '1 / -1',
        display: 'flex', gap: 'calc(var(--Pad) / 2)', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <FormControl>
          {!props.isMobile && <FormLabelStart title='Beam Count' />}
          <Box sx={{ flex: 1, display: 'flex', '& > *': { flex: 0 } }}>
            <ButtonGroup variant='outlined'>
              {[2, 4, 8].map((n) => {
                const isActive = n === props.beamCount;
                return (
                  <Button
                    key={n}
                    // variant={isActive ? 'solid' : undefined}
                    color='neutral'
                    onClick={() => props.setBeamCount(n)}
                    sx={{ fontWeight: isActive ? 'xl' : 400 /* reset, from 600 */ }}
                  >
                    {`x${n}`}
                  </Button>
                );
              })}
            </ButtonGroup>
          </Box>
        </FormControl>

        <Button variant='solid' color='primary' onClick={props.onStart}>
          Start
        </Button>
      </Box>

    </Sheet>
  );
}