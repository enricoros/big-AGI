import { Box, styled } from '@mui/joy';
import type { SxProps } from '@mui/joy/styles/types';


export const beamCardClasses = {
  errored: 'beamCard-Errored',
  selectable: 'beamCard-Selectable',
};

/**
 * Used for message-containing cards.
 */
export const BeamCard = styled(Box)(({ theme }) => ({
  '--Card-padding': '1rem',

  backgroundColor: theme.vars.palette.background.surface,
  border: '1px solid',
  borderColor: theme.vars.palette.neutral.outlinedBorder,
  borderRadius: theme.radius.md,

  padding: 'var(--Card-padding)',

  // [`&.${beamCardClasses.active}`]: {
  //   boxShadow: 'inset 0 0 0 2px #00f, inset 0 0 0 4px #00a',
  // },

  [`&.${beamCardClasses.selectable}`]: {
    backgroundColor: theme.vars.palette.background.popup,
  },
  [`&.${beamCardClasses.errored}`]: {
    backgroundColor: theme.vars.palette.danger.softBg,
    borderColor: theme.vars.palette.danger.outlinedBorder,
  },

  position: 'relative',

  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--Pad_2)',

  // uncomment the following to limit the card height
  // maxHeight: 'calc(0.8 * (100dvh - 16rem))',
  // overflow: 'auto',
}));
BeamCard.displayName = 'BeamCard'; // [shared] scatter/gather pane style

/**
 * Props for the two panes.
 */
export const beamPaneSx: SxProps = {
  // style
  backgroundColor: 'background.popup', // background.popup
  boxShadow: 'md',
  p: 'var(--Pad)',
  py: 'calc(3 * var(--Pad) / 4)',
  zIndex: 1, // cast shadow on the rays/fusion

  // layout
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--Pad_2)',
};