import type { SxProps } from '@mui/joy/styles/types';

export const liveFileSheetSx: SxProps = {
  p: 1,
  backgroundColor: 'rgb(var(--joy-palette-neutral-lightChannel) / 20%)',
  border: '1px solid',
  borderRadius: 'sm',
  borderColor: 'neutral.outlinedBorder',
  boxShadow: `inset 0 4px 6px -6px rgb(var(--joy-palette-neutral-darkChannel) / 40%)`,
  fontSize: 'sm',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 1,
  'button': {
    backgroundColor: 'background.surface',
  },
  'button:hover': {
    backgroundColor: 'background.popup',
    boxShadow: 'xs',
  },
};

