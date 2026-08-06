import * as React from 'react';

import { Box, FormControl, IconButton } from '@mui/joy';


const _styles = {
  control: {
    gap: 1,
    mt: 1,
  } as const,

  buttonGroup: {
    display: 'flex',
    justifyContent: 'space-evenly',
    // overflowX: 'hidden',
    flexWrap: 'wrap',
    minWidth: '131px',
  } as const,

  buttonActive: {
    '--IconButton-size': { xs: '1.75rem', lg: '2rem' },
  } as const,

  button: {
    '--IconButton-size': { xs: '1.75rem', lg: '2rem' },
    border: '1px solid',
    borderColor: 'warning.outlinedBorder',
    backgroundColor: 'background.popup',
    // boxShadow: drawRepeat === n ? '0px 2px 8px 0px rgb(var(--joy-palette-warning-mainChannel) / 40%)' : 'none',
    // fontWeight: drawRepeat === n ? 'xl' : 400, /* reset, from 600 */
    transition: 'transform 0.14s, box-shadow 0.14s',
    '&:hover': {
      transform: 'translateY(-1px)',
      // backgroundColor: drawRepeat === n ? 'background.popup' : 'background.surface',
      // boxShadow: '0 0 8px 1px rgb(var(--joy-palette-warning-mainChannel) / 40%)',
    } as const,
  } as const,

  text: {
    mx: 'auto',
    fontSize: 'xs',
    opacity: '0.5',
  } as const,
} as const;


export function ButtonGroupDrawRepeat(props: {
  drawRepeat: number,
  setDrawRepeat: (n: number) => void,
}) {

  const { drawRepeat, setDrawRepeat } = props;

  return (
    <FormControl sx={_styles.control}>
      <Box sx={_styles.buttonGroup}>
        {[1, 2, 4, 5, 10].map((n) => (
          <IconButton
            key={n}
            size='sm'
            color='warning'
            variant={drawRepeat === n ? 'solid' : 'soft'}
            onClick={() => setDrawRepeat(n)}
            sx={drawRepeat === n ? _styles.buttonActive : _styles.button}
          >
            {n}
          </IconButton>
        ))}
      </Box>
      <Box sx={_styles.text}>
        {drawRepeat > 1
          ? `Create ${drawRepeat} Images`
          : 'Number of Images'}
      </Box>
    </FormControl>
  );
}