import * as React from 'react';
import TimeAgo from 'react-timeago';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Tooltip, Typography } from '@mui/joy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type { DMessage } from '~/common/state/store-chats';
import { ContentScaling, lineHeightChatTextMd, themeScalingMap } from '~/common/app.theme';
import { InlineError } from '~/common/components/InlineError';

import { RenderCode, RenderCodeMemo } from './code/RenderCode';
import { RenderHtml } from './RenderHtml';
import { RenderImage } from './RenderImage';
import { RenderMarkdown, RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderChatText } from './RenderChatText';
import { RenderTextDiff } from './RenderTextDiff';
import { areBlocksEqual, Block, parseMessageBlocks } from './blocks';


// How long is the user collapsed message
const USER_COLLAPSED_LINES: number = 7;


const blocksSx: SxProps = {
  my: 'auto',
  // note: this will be used for non-blocks mainly (errors and other strings ourside of RenderXYX)
  lineHeight: lineHeightChatTextMd,
} as const;

export const editBlocksSx: SxProps = {
  ...blocksSx,
  flexGrow: 1,
} as const;

const renderBlocksSx: SxProps = {
  ...blocksSx,
  flexGrow: 0,
  overflowX: 'auto',
  '& *::selection': {
    // backgroundColor: '#fc70c3',
    backgroundColor: 'primary.solidBg',
    color: 'primary.solidColor',
  },
} as const;


type BlocksRendererProps = {
  // required
  text: string;
  fromRole: DMessage['role'];
  contentScaling: ContentScaling;
  renderTextAsMarkdown: boolean;
  renderTextDiff?: TextDiff[];

  errorMessage?: React.ReactNode;
  fitScreen: boolean;
  isBottom?: boolean;
  showDate?: number;
  showUnsafeHtml?: boolean;
  wasUserEdited?: boolean;

  specialDiagramMode?: boolean;

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
  onImageRegenerate?: () => void;

  // optimization: allow memo
  optiAllowMemo?: boolean;
};


export const BlocksRenderer = React.forwardRef<HTMLDivElement, BlocksRendererProps>((props, ref) => {

  // state
  const [forceUserExpanded, setForceUserExpanded] = React.useState(false);
  const prevBlocksRef = React.useRef<Block[]>([]);

  // derived state
  const { text: _text, errorMessage, renderTextDiff, wasUserEdited = false } = props;
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';


  // Memo text, which could be 'collapsed' to a few lines in case of user messages

  const { text, isTextCollapsed } = React.useMemo(() => {
    if (fromUser && !forceUserExpanded) {
      const textLines = _text.split('\n');
      if (textLines.length > USER_COLLAPSED_LINES)
        return { text: textLines.slice(0, USER_COLLAPSED_LINES).join('\n'), isTextCollapsed: true };
    }
    return { text: _text, isTextCollapsed: false };
  }, [forceUserExpanded, fromUser, _text]);

  const handleTextCollapse = React.useCallback(() => {
    setForceUserExpanded(false);
  }, []);

  const handleTextUncollapse = React.useCallback(() => {
    setForceUserExpanded(true);
  }, []);


  // Memo the styles, to minimize re-renders

  const scaledCodeSx: SxProps = React.useMemo(() => (
    {
      my: props.specialDiagramMode ? 0 : themeScalingMap[props.contentScaling]?.blockCodeMarginY ?? 0,
      backgroundColor: props.specialDiagramMode ? 'background.surface' : fromAssistant ? 'neutral.plainHoverBg' : 'primary.plainActiveBg',
      boxShadow: props.specialDiagramMode ? undefined : 'inset 2px 0px 5px -4px var(--joy-palette-background-backdrop)', // was 'xs'
      borderRadius: 'sm',
      fontFamily: 'code',
      fontSize: themeScalingMap[props.contentScaling]?.blockCodeFontSize ?? '0.875rem',
      fontWeight: 'md', // JetBrains Mono has a lighter weight, so we need that extra bump
      fontVariantLigatures: 'none',
      lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    }
  ), [fromAssistant, props.contentScaling, props.specialDiagramMode]);

  const scaledImageSx: SxProps = React.useMemo(() => (
    {
      fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
      lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
      marginBottom: themeScalingMap[props.contentScaling]?.blockImageGap ?? 1.5,
    }
  ), [props.contentScaling]);

  const scaledTypographySx: SxProps = React.useMemo(() => (
    {
      fontSize: themeScalingMap[props.contentScaling]?.blockFontSize ?? undefined,
      lineHeight: themeScalingMap[props.contentScaling]?.blockLineHeight ?? 1.75,
    }
  ), [props.contentScaling]);


  // Block splitter, with memoand special recycle of former blocks, to help React minimize render work

  const blocks = React.useMemo(() => {
    // split the complete input text into blocks
    const newBlocks = errorMessage ? [] : parseMessageBlocks(text, fromSystem, renderTextDiff);

    // recycle the previous blocks if they are the same, for stable references to React
    const recycledBlocks: Block[] = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];
      const prevBlock = prevBlocksRef.current[i];

      // Check if the new block can be replaced by the previous block to maintain reference stability
      if (prevBlock && areBlocksEqual(prevBlock, newBlock)) {
        recycledBlocks.push(prevBlock);
      } else {
        // Once a block doesn't match, we use the new blocks from this point forward.
        recycledBlocks.push(...newBlocks.slice(i));
        break;
      }
    }

    // Update prevBlocksRef with the current blocks for the next render
    prevBlocksRef.current = recycledBlocks;

    // Apply specialDiagramMode filter if applicable
    return props.specialDiagramMode
      ? recycledBlocks.filter(block => block.type === 'code' || recycledBlocks.length === 1)
      : recycledBlocks;
  }, [errorMessage, fromSystem, props.specialDiagramMode, renderTextDiff, text]);


  return (
    <Box
      ref={ref}
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
          (block, index) => {
            // Optimization: only memo the non-currently-rendered components, if the message is still in flux
            const optimizeWithMemo = props.optiAllowMemo && index !== blocks.length - 1;
            const RenderCodeMemoOrNot = optimizeWithMemo ? RenderCodeMemo : RenderCode;
            const RenderMarkdownMemoOrNot = optimizeWithMemo ? RenderMarkdownMemo : RenderMarkdown;
            return block.type === 'html'
              ? <RenderHtml key={'html-' + index} htmlBlock={block} sx={scaledCodeSx} />
              : block.type === 'code'
                ? <RenderCodeMemoOrNot key={'code-' + index} codeBlock={block} fitScreen={props.fitScreen} initialShowHTML={props.showUnsafeHtml} noCopyButton={props.specialDiagramMode} optimizeLightweight={!optimizeWithMemo} sx={scaledCodeSx} />
                : block.type === 'image'
                  ? <RenderImage key={'image-' + index} imageBlock={block} onRunAgain={props.isBottom ? props.onImageRegenerate : undefined} sx={scaledImageSx} />
                  : block.type === 'diff'
                    ? <RenderTextDiff key={'text-diff-' + index} diffBlock={block} sx={scaledTypographySx} />
                    : (props.renderTextAsMarkdown && !fromSystem && !(fromUser && block.content.startsWith('/')))
                      ? <RenderMarkdownMemoOrNot key={'text-md-' + index} textBlock={block} sx={scaledTypographySx} />
                      : <RenderChatText key={'text-' + index} textBlock={block} sx={scaledTypographySx} />;
          })

      )}

      {isTextCollapsed ? (
        <Box sx={{ textAlign: 'right' }}><Button variant='soft' size='sm' onClick={handleTextUncollapse} startDecorator={<ExpandMoreIcon />} sx={{ minWidth: 120 }}>Expand</Button></Box>
      ) : forceUserExpanded && (
        <Box sx={{ textAlign: 'right' }}><Button variant='soft' size='sm' onClick={handleTextCollapse} startDecorator={<ExpandLessIcon />} sx={{ minWidth: 120 }}>Collapse</Button></Box>
      )}

      {/* import VisibilityIcon from '@mui/icons-material/Visibility'; */}
      {/*<br />*/}
      {/*<Chip variant='outlined' color='warning' sx={{ mt: 1, fontSize: '0.75em' }} startDecorator={<VisibilityIcon />}>*/}
      {/*  BlockAction*/}
      {/*</Chip>*/}

    </Box>
  );
});

BlocksRenderer.displayName = 'BlocksRenderer';