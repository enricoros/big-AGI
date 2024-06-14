import * as React from 'react';
import type { Diff as TextDiff } from '@sanity/diff-match-patch';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, Typography } from '@mui/joy';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import type { DMessageRole } from '~/common/stores/chat/chat.message';
import { ContentScaling, lineHeightChatTextMd, themeScalingMap } from '~/common/app.theme';

import { RenderChatText } from './RenderChatText';
import { RenderCode, RenderCodeMemo } from './code/RenderCode';
import { RenderHtml } from './RenderHtml';
import { RenderImageURL } from './RenderImageURL';
import { RenderMarkdown, RenderMarkdownMemo } from './markdown/RenderMarkdown';
import { RenderTextDiff } from './RenderTextDiff';
import { areBlocksEqual, Block, parseMessageBlocks } from './blocks';


// How long is the user collapsed message
const USER_COLLAPSED_LINES: number = 7;


/**
 * This style is reused by all the Fragments (BlocksRenderer being the Text one),
 * contained within a singe Grid (1fr) in the Message component.
 */
export const blocksRendererSx: SxProps = {
  // important, as the parent container is a Grid, and this takes up to the Grid's width
  width: '100%',

  // enables children's x-scrollbars (clips to the Fragment, so sub-parts will stay within this)
  overflowX: 'auto',

  // note: this will be used for non-blocks mainly (errors and other strings ourside of RenderXYX)
  lineHeight: lineHeightChatTextMd,

  // customize the text selection color (also in edit mode)
  '& *::selection': {
    // backgroundColor: '#fc70c3',
    backgroundColor: 'primary.solidBg',
    color: 'primary.solidColor',
  },
} as const;


type BlocksRendererProps = {
  // required
  text: string;
  fromRole: DMessageRole;

  contentScaling: ContentScaling;
  fitScreen: boolean;
  isBottom?: boolean;
  showUnsafeHtml?: boolean;
  showTopWarning?: string;
  specialDiagramMode?: boolean;

  renderTextAsMarkdown: boolean;
  renderTextDiff?: TextDiff[];

  /**
   * optimization: allow memo to all individual blocks except the last one
   * work in progress on that
   */
  optiAllowSubBlocksMemo?: boolean;

  onContextMenu?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
};


export const BlocksRenderer = React.forwardRef<HTMLDivElement, BlocksRendererProps>((props, ref) => {

  // state
  const [forceUserExpanded, setForceUserExpanded] = React.useState(false);
  const prevBlocksRef = React.useRef<Block[]>([]);

  // derived state
  const { text: _text, renderTextDiff } = props;
  const fromAssistant = props.fromRole === 'assistant';
  const fromSystem = props.fromRole === 'system';
  const fromUser = props.fromRole === 'user';
  const isUserCommand = fromUser && _text.startsWith('/');


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
    const newBlocks = parseMessageBlocks(text, fromSystem, renderTextDiff);

    // recycle the previous blocks if they are the same, for stable references to React
    const recycledBlocks: Block[] = [];
    for (let i = 0; i < newBlocks.length; i++) {
      const newBlock = newBlocks[i];
      const prevBlock: Block | undefined = prevBlocksRef.current[i];

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
      ? recycledBlocks.filter(block => block.type === 'codeb' || recycledBlocks.length === 1)
      : recycledBlocks;
  }, [fromSystem, props.specialDiagramMode, renderTextDiff, text]);


  return (
    <Box
      ref={ref}
      onContextMenu={props.onContextMenu}
      onDoubleClick={props.onDoubleClick}
      sx={blocksRendererSx}
    >

      {/* Warn about user-edited system message */}
      {!!props.showTopWarning?.length && (
        <Typography level='body-sm' color='warning' sx={{ mt: 1, mx: 1.5 }}>{props.showTopWarning}</Typography>
      )}

      {/* sequence of render components, for each Block */}
      {blocks.map((block, index) => {
        // Optimization: only memo the non-currently-rendered components, if the message is still in flux
        const optimizeSubBlockWithMemo = props.optiAllowSubBlocksMemo && index !== blocks.length - 1;
        const RenderCodeMemoOrNot = optimizeSubBlockWithMemo ? RenderCodeMemo : RenderCode;
        const RenderMarkdownMemoOrNot = optimizeSubBlockWithMemo ? RenderMarkdownMemo : RenderMarkdown;
        return block.type === 'htmlb'
          ? <RenderHtml key={'html-' + index} htmlBlock={block} sx={scaledCodeSx} />
          : block.type === 'codeb'
            ? <RenderCodeMemoOrNot key={'code-' + index} codeBlock={block} fitScreen={props.fitScreen} initialShowHTML={props.showUnsafeHtml} noCopyButton={props.specialDiagramMode} optimizeLightweight={!optimizeSubBlockWithMemo} sx={scaledCodeSx} />
            : block.type === 'imageb'
              ? <RenderImageURL key={'image-' + index} imageURL={block.url} infoText={block.alt}
                                onImageRegenerate={undefined /* because there could be many of these URL images in a fragment, and we miss the whole partial-edit logic in a text fragment */}
                                scaledImageSx={scaledImageSx} />
              : block.type === 'diffb'
                ? <RenderTextDiff key={'text-diff-' + index} diffBlock={block} sx={scaledTypographySx} />
                : (props.renderTextAsMarkdown && !fromSystem && !isUserCommand)
                  ? <RenderMarkdownMemoOrNot key={'text-md-' + index} textBlock={block} sx={scaledTypographySx} />
                  : <RenderChatText key={'text-' + index} textBlock={block} sx={scaledTypographySx} />;
      })}

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