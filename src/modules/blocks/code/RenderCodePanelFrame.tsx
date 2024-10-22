import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, Sheet, useColorScheme } from '@mui/joy';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';


export const enhancedCodePanelTitleTooltipSx: SxProps = {
  p: 1,
  display: 'grid',
  gridTemplateColumns: 'auto 1fr auto 1fr',
  alignItems: 'center',
  columnGap: 2,
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
  headerRow?: React.ReactNode;
  subHeaderInline?: React.ReactNode;
  toolbarRow?: React.ReactNode;
  onHeaderClick?: () => void;
  onHeaderContext?: (event: React.MouseEvent<HTMLElement>) => void;
  children: React.ReactNode;
}) {

  // react to scheme change
  const isDarkMode = useColorScheme().mode === 'dark';

  // handlers

  const { onHeaderClick } = props;
  const isClickableHeader = !!onHeaderClick;

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (onHeaderClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onHeaderClick();
    }
  }, [onHeaderClick]);


  const [frameSx, headersBlockSx, headerRowSx, subHeaderContainedSx, toolbarRowSx] = React.useMemo((): SxProps[] => [
    {
      // frame
      // add top margin (gutter) only of this is not the first block in the sequence
      ...(props.gutterBlock && {
        '&:not(:first-of-type)': { mt: themeScalingMap[props.contentScaling]?.blockCodeMarginY ?? 1 },
        '&:not(:last-of-type)': { mb: themeScalingMap[props.contentScaling]?.blockCodeMarginY /* * 1.25 */ ?? 1 },
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
      ...(isClickableHeader && {
        cursor: 'pointer',
        borderRadius: 'sm',
        '&:hover': {
          backgroundColor: 'background.popup',
        },
      }),
    },
    {
      // header row 1
      // see DocAttachmentFragmentButton.buttonSx for the same scaling
      minHeight: props.contentScaling === 'xs' ? '2.25rem' : props.contentScaling === 'sm' ? '2.375rem' : '2.5rem',
      px: 1,
      // borderRadius: 'sm',
      // borderBottomLeftRadius: 0,
      // borderBottomRightRadius: 0,
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

  ], [isClickableHeader, isDarkMode, props.color, props.contentScaling, props.gutterBlock, props.noOuterShadow, props.toolbarColor]);

  return (
    <Box sx={frameSx}>

      {/* header(s) */}
      {(!!props.headerRow || !!props.subHeaderInline) && (
        <Box
          aria-label={isClickableHeader ? 'Click to expand/collapse' : undefined}
          role={isClickableHeader ? 'button' : undefined}
          tabIndex={isClickableHeader ? 0 : undefined}
          onKeyDown={handleKeyDown}
          onClick={props.onHeaderClick}
          onContextMenu={props.onHeaderContext}
          sx={headersBlockSx}
        >
          {props.headerRow && (
            <Box sx={headerRowSx}>
              {props.headerRow}
            </Box>
          )}
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

      {/* contents */}
      {props.children}

    </Box>
  );
}