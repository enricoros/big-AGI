import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, CircularProgress, IconButton, Tooltip } from '@mui/joy';
import { ClickAwayListener, Popper } from '@mui/base';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import ReplyAllRoundedIcon from '@mui/icons-material/ReplyAllRounded';
import ReplyRoundedIcon from '@mui/icons-material/ReplyRounded';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';

import { MarkHighlightIcon } from '~/common/components/icons/MarkHighlightIcon';
import { PhPaintBrush } from '~/common/components/icons/phosphor/PhPaintBrush';
import { PhTreeStructure } from '~/common/components/icons/phosphor/PhTreeStructure';
import { PhVoice } from '~/common/components/icons/phosphor/PhVoice';
import { themeZIndexChatBubble } from '~/common/app.theme';

import type { HighlightTool } from './useSelHighlighterMemo';


const _styles = {
  container: {
    backgroundColor: 'background.popup',
    border: '1px solid',
    borderColor: 'primary.outlinedBorder',
    boxShadow: '0px 4px 24px -8px rgb(var(--joy-palette-neutral-darkChannel) / 50%)',
    borderRadius: 'sm',
    p: 0.5,
    mb: 1.5,
    ml: -1.5,
    display: 'flex',
    alignItems: 'stretch',
    overflow: 'hidden',
    gap: 0.5,
  },
  gridX2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  gridButton: {
    '--Icon-fontSize': 'var(--joy-fontSize-lg, 1.125rem)',
    minHeight: '2.25rem',
    minWidth: '2.25rem',
    // borderRadius: 0,
  },
  actionButton: {
    '--Icon-fontSize': 'var(--joy-fontSize-lg, 1.125rem)',
    // minHeight: '2.5rem',
    minWidth: '2.75rem',
  },
  separatorV: {
    borderLeft: '1px solid',
    borderColor: 'divider',
  },
} as const satisfies Record<string, SxProps>;


export function ChatMessageBubble(props: {
  anchorEl: HTMLElement;
  onClose: (event?: MouseEvent | TouchEvent) => void;
  selText: string | null;
  fromAssistant: boolean;
  // reference
  hasInReferenceTo: boolean;
  onReferenceTo?: (e: React.MouseEvent) => void;
  // text edit tools
  onHighlight: ((tool: HighlightTool) => void) | null;
  // AI tools
  onImagine?: (e: React.MouseEvent) => void;
  onSpeak?: (e: React.MouseEvent) => void;
  onDiagram?: (e: React.MouseEvent) => void;
  isImagining: boolean;
  isSpeaking?: boolean;
  couldImagine: boolean;
  couldSpeak: boolean;
  couldDiagram: boolean;
  // copy
  onCopy: (e: React.MouseEvent) => void;
}) {

  // destructure
  const { fromAssistant, selText, onHighlight, onClose } = props;

  // derived
  const hasAITools = !!(props.onImagine || props.onSpeak || props.onDiagram);


  const handleHighlightAndClose = React.useCallback((tool: HighlightTool) => {
    onHighlight?.(tool);
    onClose();
  }, [onHighlight, onClose]);


  return (
    <Popper placement='top-start' open anchorEl={props.anchorEl} slotProps={{
      root: { style: { zIndex: themeZIndexChatBubble } },
    }}>
      <ClickAwayListener onClickAway={props.onClose}>
        <Box sx={_styles.container}>

          {/* Refer to */}
          {!!props.onReferenceTo && (
            <Tooltip color='primary' disableInteractive arrow placement='top' title={props.hasInReferenceTo ? 'Refer to this too' : 'Refer to'}>
              <IconButton variant='plain' color='primary' onClick={props.onReferenceTo} sx={_styles.actionButton}>
                {props.hasInReferenceTo ? <ReplyAllRoundedIcon /> : <ReplyRoundedIcon />}
              </IconButton>
            </Tooltip>
          )}


          {!!props.onReferenceTo && <Box sx={_styles.separatorV} />}


          {/* Text Tools 2x2 */}
          {fromAssistant && <Box sx={_styles.gridX2}>

            <Tooltip disableInteractive arrow placement='top' title='Highlight Text'>
              <IconButton variant='plain' disabled={!onHighlight} sx={_styles.gridButton} onClick={!onHighlight ? undefined : () => handleHighlightAndClose('highlight')}>
                <MarkHighlightIcon hcolor={onHighlight ? 'yellow' : undefined} />
              </IconButton>
            </Tooltip>

            <Tooltip disableInteractive arrow placement='top' title='Cut Text'>
              <IconButton variant='plain' disabled={!onHighlight} sx={_styles.gridButton} onClick={!onHighlight ? undefined : () => handleHighlightAndClose('cut')}>
                <ContentCutIcon />
              </IconButton>
            </Tooltip>

            <Tooltip disableInteractive arrow placement='top' title='Toggle Bold'>
              <IconButton variant='plain' disabled={!onHighlight} sx={_styles.gridButton} onClick={!onHighlight ? undefined : () => handleHighlightAndClose('strong')}>
                <FormatBoldIcon />
              </IconButton>
            </Tooltip>

            <Tooltip disableInteractive arrow placement='top' title='Strike Through'>
              <IconButton variant='plain' disabled={!onHighlight} sx={_styles.gridButton} onClick={!onHighlight ? undefined : () => handleHighlightAndClose('strike')}>
                <StrikethroughSIcon />
              </IconButton>
            </Tooltip>

          </Box>}


          {fromAssistant && <Box sx={_styles.separatorV} />}


          {/* AI Tools 2x2: Draw, Speak / Diagram, (empty) */}
          {hasAITools && <Box sx={_styles.gridX2}>

            {props.onImagine && <Tooltip color='success' disableInteractive arrow placement='top' title='Draw this concept'>
              <IconButton variant='plain' color='success' onClick={props.onImagine} disabled={!props.couldImagine || props.isImagining} sx={_styles.gridButton}>
                {!props.isImagining ? <PhPaintBrush /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
              </IconButton>
            </Tooltip>}

            {props.onSpeak && <Tooltip color='success' disableInteractive arrow placement='top' title='Read aloud'>
              <IconButton variant='plain' color='success' onClick={props.onSpeak} disabled={!props.couldSpeak || props.isSpeaking} sx={_styles.gridButton}>
                {!props.isSpeaking ? <PhVoice /> : <CircularProgress sx={{ '--CircularProgress-size': '16px' }} />}
              </IconButton>
            </Tooltip>}

            {props.onDiagram && <Tooltip color={props.couldDiagram ? 'success' : undefined} disableInteractive arrow placement='top' title={props.couldDiagram ? 'Create a diagram' : 'Too short to Auto-Diagram'}>
              <IconButton variant='plain' color='success' onClick={props.couldDiagram ? props.onDiagram : undefined} sx={_styles.gridButton}>
                <PhTreeStructure sx={{ color: props.couldDiagram ? 'primary' : 'neutral.plainDisabledColor' }} />
              </IconButton>
            </Tooltip>}

            {/* 4th item, not there yet */}

          </Box>}


          {hasAITools && <Box sx={_styles.separatorV} />}


          {/* Copy (tooltip includes char & word count) */}
          <Tooltip variant='outlined' disableInteractive arrow placement='top' title={!selText ? 'Copy' :
            <>Copy rich text<Box fontSize='xs' mt={0.5}>{selText.length.toLocaleString()} ch · {(selText.match(/\S+/g) || []).length.toLocaleString()} words</Box></>
          }>
            <IconButton variant='plain' onClick={props.onCopy} sx={_styles.actionButton}>
              <ContentCopyIcon />
            </IconButton>
          </Tooltip>

        </Box>
      </ClickAwayListener>
    </Popper>
  );
}
