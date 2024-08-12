import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, Sheet, useColorScheme } from '@mui/joy';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';


export const enhancedCodePanelTitleTooltipSx: SxProps = {
  p: 1,
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  columnGap: 1,
  rowGap: 1,
  '& > :nth-of-type(odd)': {
    color: 'text.tertiary',
    fontSize: 'xs',
  },
};


export function RenderCodePanelFrame(props: {
  color: ColorPaletteProp;
  toolbarColor?: ColorPaletteProp;
  gutterBlock?: boolean;
  noOuterShadow?: boolean;
  contentScaling: ContentScaling;
  headerRow: React.ReactNode;
  subHeaderInline?: React.ReactNode;
  toolbarRow?: React.ReactNode;
  onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void;
  children: React.ReactNode;
}) {

  // react to scheme change
  const isDarkMode = useColorScheme().mode === 'dark';

  const [frameSx, headersBlockSx, headerRowSx, subHeaderContainedSx, toolbarRowSx] = React.useMemo((): SxProps[] => [
    {
      // frame
      // add top margin (gutter) only of this is not the first block in the sequence
      ...(props.gutterBlock && {
        '&:not(:first-of-type)': { mt: themeScalingMap[props.contentScaling]?.blockCodeMarginY ?? 1 },
        '&:not(:last-of-type)': { mb: themeScalingMap[props.contentScaling]?.blockCodeMarginY ?? 1 },
      }),
      backgroundColor: /*props.noOuterShadow ? 'background.popup' :*/ 'background.surface',
      border: '1px solid',
      borderColor: `${props.color}.outlinedBorder`,
      borderRadius: 'sm',
      ...(!props.noOuterShadow && { boxShadow: 'sm' }),
      // boxShadow: 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)',
      // contain: 'paint',
    },
    {
      // headers block
      // border moved to: Toolbar (for the Attachment Doc Part) and children (for the Code block)
      // borderBottom: '1px solid',
      // borderBottomColor: `${props.toolbarColor || props.color}.outlinedBorder`,
    },
    {
      // header row 1
      // see DocAttachmentFragmentButton.buttonSx for the same scaling
      minHeight: props.contentScaling === 'xs' ? '2.25rem' : props.contentScaling === 'sm' ? '2.375rem' : '2.5rem',
      px: 1,
      // borderRadius: 'sm',
      // borderBottomLeftRadius: 0,
      // borderBottomRightRadius: 0,
      // '&:hover': {
      //   backgroundColor: `background.popup`,
      // },
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
      borderTop: '1px solid',
      borderTopColor: `${props.toolbarColor || props.color}.outlinedBorder`,
      borderBottom: '1px solid',
      borderBottomColor: /*isEditing ? 'transparent' :*/ `${props.toolbarColor || props.color}.outlinedBorder`,
      p: 1,
      // layout
      display: 'grid',
      gap: 1,
    },

  ], [isDarkMode, props.color, props.contentScaling, props.gutterBlock, props.noOuterShadow, props.toolbarColor]);

  return (
    <Box sx={frameSx}>

      {/* header(s) */}
      <Box sx={headersBlockSx} onContextMenu={props.onContextMenu}>
        <Box sx={headerRowSx}>
          {props.headerRow}
        </Box>
        {props.subHeaderInline && (
          <Box sx={subHeaderContainedSx}>
            {props.subHeaderInline}
          </Box>
        )}
      </Box>

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