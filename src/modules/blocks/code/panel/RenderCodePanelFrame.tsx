import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, Sheet, useColorScheme } from '@mui/joy';


export function RenderCodePanelFrame(props: {
  color: ColorPaletteProp,
  toolbarColor?: ColorPaletteProp,
  headerRow?: React.ReactNode;
  subHeaderInline?: React.ReactNode;
  toolbarRow?: React.ReactNode;
  children: React.ReactNode;
}) {

  // react to scheme change
  const isDarkMode = useColorScheme().mode === 'dark';

  const [frameSx, headersBlockSx, headerRowSx, subHeaderContainedSx, toolbarRowSx] = React.useMemo((): SxProps[] => [
    {
      // frame
      mt: 0.5,
      backgroundColor: 'background.surface',
      border: '1px solid',
      borderColor: `${props.color}.outlinedBorder`,
      borderRadius: 'sm',
      boxShadow: 'sm',
      // boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
      // contain: 'paint',
    },
    {
      // headers block
      borderBottom: '1px solid',
      borderBottomColor: `${props.toolbarColor || props.color}.outlinedBorder`,
    },
    {
      // header row 1
      minHeight: '2.75rem',
      mx: 1,
      // layout
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 1,
    },
    {
      // subheader row 2
      m: 1,
      mt: 0,
    },
    {
      // toolbar row
      backgroundColor: `${props.toolbarColor || props.color}.${isDarkMode ? 900 : 50}`,
      borderBottom: '1px solid',
      borderBottomColor: /*isEditing ? 'transparent' :*/ `${props.toolbarColor || props.color}.outlinedBorder`,
      p: 1,
      // layout
      display: 'grid',
      gap: 1,
    },

  ], [isDarkMode, props.color, props.toolbarColor]);

  return (
    <Box sx={frameSx}>

      {/* header(s) */}
      {(props.headerRow || props.subHeaderInline) && (
        <Box sx={headersBlockSx}>
          <Box sx={headerRowSx}>
            {props.headerRow}
          </Box>
          {props.subHeaderInline && (
            <Box sx={subHeaderContainedSx}>
              {props.subHeaderInline}
            </Box>
          )}
        </Box>
      )}

      {/* toolbar */}
      {props.toolbarRow && (
        <Sheet color='primary' variant='soft' sx={toolbarRowSx}>
          {props.toolbarRow}
        </Sheet>
      )}

      {props.children}

    </Box>
  );
}