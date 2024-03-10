import * as React from 'react';

import { Box, Button, ButtonGroup, FormControl, Typography } from '@mui/joy';

import { FormLabelStart } from '~/common/components/forms/FormLabelStart';


export function BeamHeader(props: {
  isMobile: boolean,
  rayCount: number,
  setRayCount: (n: number) => void,
  llmSelectComponent: React.ReactNode,
  onStart: () => void,
}) {

  return (
    <Box
      // variant='outlined'
      sx={{
        // style
        // borderRadius: 'md',
        // backgroundColor: 'background.popup',
        backgroundColor: 'background.surface',
        boxShadow: 'md',
        p: 'var(--Pad)',

        // layout: max 2 cols (/3 with gap) of min 200px per col
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(max(200px, 100%/4), 1fr))',
        gridAutoFlow: 'row dense',
        gap: 'var(--Pad_2)',

        // '& > *': { border: '1px solid red' },
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
      </Box>

      {/* Count and Start cell */}
      <FormControl sx={{ flex: 1, display: 'flex', justifyContent: 'space-between' /* gridColumn: '1 / -1' */ }}>
        {!props.isMobile && <FormLabelStart title='Beam Count' />}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* xN buttons */}
          <ButtonGroup variant='outlined' sx={{ flex: 1, display: 'flex', '& > *': { flex: 1 } }}>
            {[2, 4, 8].map((n) => {
              const isActive = n === props.rayCount;
              return (
                <Button
                  key={n}
                  // variant={isActive ? 'solid' : undefined}
                  color='neutral'
                  onClick={() => props.setRayCount(n)}
                  sx={{
                    fontWeight: isActive ? 'xl' : 400, /* reset, from 600 */
                    backgroundColor: isActive ? 'background.popup' : undefined,
                    maxWidth: '3rem',
                  }}
                >
                  {`x${n}`}
                </Button>
              );
            })}
          </ButtonGroup>

          {/* Start ... */}
          <Button
            variant='solid' color='success'
            onClick={props.onStart}
            // endDecorator={<ChatBeamIcon />}
            sx={{ ml: 'auto', minWidth: 80 }}
          >
            Start
          </Button>
        </Box>
      </FormControl>

    </Box>
  );
}