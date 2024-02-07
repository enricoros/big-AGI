import * as React from 'react';
import TimeAgo from 'react-timeago';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Tooltip, Typography } from '@mui/joy';

import type { DMessage } from '~/common/state/store-chats';
import { InlineError } from '~/common/components/InlineError';
import { lineHeightChatText } from '~/common/app.theme';

import { RenderCode } from './code/RenderCode';
import { RenderHtml } from './RenderHtml';
import { RenderImage } from './RenderImage';
import { RenderLatex } from './RenderLatex';
import { RenderMarkdown } from './RenderMarkdown';
import { RenderText } from './RenderText';
import { RenderTextDiff } from './RenderTextDiff';
import { parseMessageBlocks } from './blocks';


// How long is the user collapsed message
const USER_COLLAPSED_LINES: number = 8;


const blocksSx: SxProps = {
  my: 'auto',
  lineHeight: lineHeightChatText,
} as const;

export const editBlocksSx: SxProps = {
  ...blocksSx,
  flexGrow: 1,
} as const;

const renderBlocksSx: SxProps = {
  ...blocksSx,
  flexGrow: 0,
  overflowX: 'auto',
} as const;

const typographySx: SxProps = {
  lineHeight: lineHeightChatText,
} as const;


export function BlocksRenderer(props: {

  // required
  text: string;
  fromRole: DMessage['role'];
  renderTextAsMarkdown: boolean;

  errorMessage?: React.ReactNode;
  isBottom?: boolean;
  showDate?: number;
  textDiffs?: TextDiff[];
  wasUserEdited?: boolean;

  specialDiagramMode?: boolean;

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
  onImageRegenerate?: () => void;

}) {

  // state
  const [forceUserExpanded, setForceUserExpanded] = React.useState(false);

  // derived state
  const { text: _text, textDiffs, errorMessage, wasUserEdited = false } = props;
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';


  // Memo text, blocks and styles

  const { text, isTextCollapsed } = React.useMemo(() => {
    if (fromUser && !forceUserExpanded) {
      const textLines = _text.split('\n');
      if (textLines.length > USER_COLLAPSED_LINES)
        return { text: textLines.slice(0, USER_COLLAPSED_LINES).join('\n'), isTextCollapsed: true };
    }
    return { text: _text, isTextCollapsed: false };
  }, [forceUserExpanded, fromUser, _text]);

  const blocks = React.useMemo(() => {
    const blocks = errorMessage ? [] : parseMessageBlocks(text, fromSystem, textDiffs || null);
    return props.specialDiagramMode ? blocks.filter(block => block.type === 'code' || blocks.length === 1) : blocks;
  }, [errorMessage, fromSystem, props.specialDiagramMode, text, textDiffs]);

  const codeSx: SxProps = React.useMemo(() => (
    {
      backgroundColor: props.specialDiagramMode ? 'background.surface' : fromAssistant ? 'neutral.plainHoverBg' : 'primary.plainActiveBg',
      boxShadow: 'xs',
      fontFamily: 'code',
      fontSize: '0.875rem',
      fontVariantLigatures: 'none',
      lineHeight: lineHeightChatText,
      borderRadius: 'var(--joy-radius-sm)',
    }
  ), [fromAssistant, props.specialDiagramMode]);


  const handleTextUncollapse = React.useCallback(() => {
    setForceUserExpanded(true);
  }, []);


  return (
    <Box
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
      sx={renderBlocksSx}
    >

      {!!props.showDate && (
        <Typography level='body-sm' sx={{ mx: 1.5, textAlign: fromAssistant ? 'left' : 'right' }}>
          <TimeAgo date={props.showDate} />
        </Typography>
      )}

      {/* Warn about user-edited system message */}
      {fromSystem && wasUserEdited && (
        <Typography level='body-sm' color='warning' sx={{ mt: 1, mx: 1.5 }}>modified by user - auto-update disabled</Typography>
      )}

      {errorMessage ? (

        <Tooltip title={<Typography sx={{ maxWidth: 800 }}>{text}</Typography>} variant='soft'>
          <InlineError error={errorMessage} />
        </Tooltip>

      ) : (

        // sequence of render components, for each Block
        blocks.map(
          (block, index) =>
            block.type === 'html'
              ? <RenderHtml key={'html-' + index} htmlBlock={block} sx={codeSx} />
              : block.type === 'code'
                ? <RenderCode key={'code-' + index} codeBlock={block} sx={codeSx} noCopyButton={props.specialDiagramMode} />
                : block.type === 'image'
                  ? <RenderImage key={'image-' + index} imageBlock={block} isFirst={!index} allowRunAgain={props.isBottom === true} onRunAgain={props.onImageRegenerate} />
                  : block.type === 'latex'
                    ? <RenderLatex key={'latex-' + index} latexBlock={block} sx={typographySx} />
                    : block.type === 'diff'
                      ? <RenderTextDiff key={'latex-' + index} diffBlock={block} sx={typographySx} />
                      : (props.renderTextAsMarkdown && !fromSystem && !(fromUser && block.content.startsWith('/')))
                        ? <RenderMarkdown key={'text-md-' + index} textBlock={block} />
                        : <RenderText key={'text-' + index} textBlock={block} sx={typographySx} />)

      )}

      {isTextCollapsed && <Button variant='plain' color='neutral' onClick={handleTextUncollapse}>... expand ...</Button>}

      {/* import VisibilityIcon from '@mui/icons-material/Visibility'; */}
      {/*<br />*/}
      {/*<Chip variant='outlined' color='warning' sx={{ mt: 1, fontSize: '0.75em' }} startDecorator={<VisibilityIcon />}>*/}
      {/*  BlockAction*/}
      {/*</Chip>*/}

    </Box>
  );
}