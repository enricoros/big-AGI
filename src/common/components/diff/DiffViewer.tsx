import * as React from 'react';
import { diffChars, diffLines } from 'diff';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Checkbox, Dropdown, IconButton, ListDivider, ListItemDecorator, Menu, MenuButton, MenuItem } from '@mui/joy';
import CompressRoundedIcon from '@mui/icons-material/CompressRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContrastIcon from '@mui/icons-material/Contrast';
import ExpandRoundedIcon from '@mui/icons-material/ExpandRounded';
import FlipIcon from '@mui/icons-material/Flip';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SpaceBarIcon from '@mui/icons-material/SpaceBar';
import WrapTextIcon from '@mui/icons-material/WrapText';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';

import { useScaledCodeSx } from '~/modules/blocks/blocks.styles';

import type { ContentScaling } from '~/common/app.theme';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { useFullscreenElement } from '~/common/components/useFullscreenElement';


// configuration
const FORCE_LINE_HEIGHT: number | false = false;
const COLLAPSE_THRESHOLD = 6; // Minimum number of unchanged lines to trigger collapsing
const CONTEXT_LINES = 3; // Number of context lines before and after collapsed section

/**
 * LineDiff represents a single line in the diff with metadata.
 */
interface LineDiff {
  oldNum: number | '';
  newNum: number | '';
  oldType: 'added' | 'removed' | 'modifiedLeft' | 'unchanged' | 'empty' | 'expander';
  newType: 'added' | 'removed' | 'modifiedRight' | 'unchanged' | 'empty' | 'expander';
  oldText: string;
  newText: string;
  collapseId?: number;
}


/**
 * A simple diff viewer that compares two strings and highlights the differences.
 */
export function DiffViewer(props: {
  oldTitle?: string;
  oldText: string;
  newTitle?: string;
  newText: string;
  contentScaling: ContentScaling;
  updatingRight?: boolean;
  policyUnchangedWhenEmpty?: boolean;
  initialViewType: 'split' | 'unified';
  initialShrinkHeight?: boolean;
  initialWrapLongLines?: boolean;
  initialIgnoreWhitespace?: boolean;
  renderMode?: 'modal'; // if set this will take the full size, or show a scrollbar
  sx?: SxProps;
}) {

  //state
  const [highContrast, setHighContrast] = React.useState(true);
  const [viewType, setViewType] = React.useState(props.initialViewType);
  const [_shrinkHeight, setShrinkHeight] = React.useState(props.initialShrinkHeight === true);
  const [wrapLongLines, setWrapLongLines] = React.useState(props.initialWrapLongLines === true); // if omitted, do not wrap lines
  const [expandedBlocks, setExpandedBlocks] = React.useState<Set<number>>(new Set());
  const [ignoreWhitespace, setIgnoreWhitespace] = React.useState(props.initialIgnoreWhitespace === true);
  const fullScreenElementRef = React.useRef<HTMLDivElement>(null);

  // external state
  const { isFullscreen, enterFullscreen, exitFullscreen } = useFullscreenElement(fullScreenElementRef);

  // derived state
  const { oldText, newText } = props;
  const inModal = props.renderMode === 'modal';
  const shrinkHeight = _shrinkHeight && !isFullscreen;

  // memoized styles
  const containerStyle: SxProps = React.useMemo(() => ({
    ...props.sx,
    overflow: !inModal ? 'hidden' : 'auto',

    // enable scrolling for fullscreen
    '&:fullscreen': {
      overflow: 'auto',
    },
  }), [inModal, props.sx]);

  const scaledCodeSx = useScaledCodeSx(true, props.contentScaling, 'embedded-plain');

  const smallerCodeFontSize = {
    'md': '0.75rem',
    'sm': '0.75rem',
    'xs': '0.6875rem',
  }[props.contentScaling] || scaledCodeSx.fontSize;

  // Max lines between old and new text
  const maxLines = Math.max((oldText || '').split('\n').length, (newText || '').split('\n').length, 1);
  const maxLinesDigits = maxLines.toString().length;
  const dotString = '.'.repeat(maxLinesDigits - 1).slice(-3);
  const colSize = `${maxLinesDigits * 0.42 + 0.72}rem`;

  const gridStyle: SxProps = React.useMemo(() => ({

    // size
    ...(shrinkHeight && {
      height: 'calc(max(80dvh, 42rem) - 20rem)',
      overflow: 'auto',
    }),
    ...(inModal && {
      height: 'max-content',
      // NOTE: this used to be set here, however we also set it on the container, which made the sticky header not work
      // overflow: 'auto',
    }),

    // Font - same as Code blocks (useScaledCodeSx)
    fontFamily: scaledCodeSx.fontFamily,
    fontSize: smallerCodeFontSize,
    fontWeight: scaledCodeSx.fontWeight,
    fontVariantLigatures: scaledCodeSx.fontVariantLigatures,
    lineHeight: FORCE_LINE_HEIGHT ? FORCE_LINE_HEIGHT : scaledCodeSx.lineHeight,

    // Layout
    display: 'grid',
    gridTemplateColumns: viewType === 'unified' ? `${colSize} ${colSize} 1fr` : `${colSize} 1fr ${colSize} 1fr`,

    // Title row
    '.dv-title': {
      fontFamily: 'body',
      fontSize: 'xs',
      fontWeight: 'sm',
      backgroundColor: 'neutral.plainHoverBg',
      borderBottom: '1px solid',
      borderBottomColor: 'divider',
      // color: 'text.tertiary',
      padding: '0.5rem',
      // paddingLeft: '1rem',
      // textAlign: 'center',
      // stick the title row (every cell to the top)
      position: 'sticky',
      top: 0,
    },

    // Line Numbers
    '.dv-num-right': { borderLeft: '1px solid', borderLeftColor: 'divider' },
    '.dv-num': {
      color: 'text.tertiary',
      userSelect: 'none',
      textAlign: 'right',
      paddingTop: '1px',
      paddingRight: '0.375rem',
      fontSize: '0.9em',
      fontWeight: 400,
      // transition: 'background-color 0.12s linear, color 0.12s linear',
    },
    '.dv-num.unchanged': { backgroundColor: 'neutral.softBg' },
    '.dv-num.removed, .dv-num.modifiedLeft': { backgroundColor: 'danger.solidBg', color: 'danger.solidColor' },
    '.dv-num.added, .dv-num.modifiedRight': { backgroundColor: 'success.solidBg', color: 'success.solidColor' },
    '.dv-num.empty': { backgroundColor: 'background.level1' },
    '.dv-num.expander': { backgroundColor: 'background.level2', cursor: 'pointer', userSelect: 'none' },
    // '.dv-num.expander': { backgroundColor: 'primary.softBg', cursor: 'pointer' },

    // Content
    '.dv-line': {
      flexGrow: 1,
      paddingLeft: '1rem',
      // Line wrapping (default) or scrolling
      ...(wrapLongLines ? {
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      } : {
        whiteSpace: 'pre',
        wordBreak: 'normal',
        /**
         * NOTE: we had overflowX: 'auto', but it was displaying a per-line scrollbar
         * this would probably need a full layout change with column-wide scrollable containers.
         * So for now we just truncate the thing.
         */
        overflowX: 'hidden',
      }),
      // transition: 'background-color 0.12s linear, color 0.12s linear',
    },

    // Content Backgrounds
    '.dv-line.unchanged': { backgroundColor: 'background.surface' },
    '.dv-line.removed, .dv-line.modifiedLeft': { backgroundColor: 'danger.softBg' },
    '.dv-line.added, .dv-line.modifiedRight': { backgroundColor: 'success.softBg' },
    '.dv-line.empty': { backgroundColor: 'background.level2' },
    '.dv-line.expander': {
      backgroundColor: 'background.level3',
      // backgroundColor: 'primary.softHoverBg',
      textAlign: 'center',
      fontStyle: 'italic',
      cursor: 'pointer',
      color: 'text.secondary',
      boxShadow: 'inset 0 2px 2px -1px rgba(0, 0, 0, 0.2)',
      '&:hover': { backgroundColor: 'background.level2' },
    },
    '.dv-line.unselectable': { userSelect: 'none' },

    // Inline Word Diff Highlights
    '.inserted': { backgroundColor: highContrast ? 'success.softActiveBg' : 'success.plainActiveBg', paddingY: '0.125rem', borderRadius: '0.125rem' }, // was 'success.softActiveBg'
    '.deleted': { backgroundColor: highContrast ? 'danger.softActiveBg' : 'danger.plainActiveBg', paddingY: '0.125rem', borderRadius: '0.125rem' },   // was 'danger.softActiveBg'

    // Dimmed styles
    '.dv-line.dimmed:not(.modifiedLeft)': {
      backgroundColor: 'background.level1',
      color: 'neutral.plainDisabledColor',
    },
    '.dv-num.dimmed:not(.modifiedLeft)': {
      color: 'neutral.plainDisabledColor',
    },

  }), [colSize, highContrast, inModal, scaledCodeSx, shrinkHeight, smallerCodeFontSize, viewType, wrapLongLines]);


  /**
   * Compute the unified data model from diffs.
   */
  const unifiedDiffData = React.useMemo((): LineDiff[] => {
    // if the old is empty and the policy requires it, do not consider the right side
    if (props.policyUnchangedWhenEmpty && (!oldText || !newText)) {
      const text = oldText || newText;
      const lines = text.split('\n');
      return lines.map((lineContent, index) => ({
        oldNum: oldText ? index + 1 : '',
        newNum: newText ? index + 1 : '',
        oldType: oldText ? 'unchanged' : 'empty',
        newType: newText ? 'unchanged' : 'empty',
        oldText: oldText ? lineContent : '',
        newText: newText ? lineContent : '',
      }));
    }

    const diffs = diffLines(oldText, newText, { ignoreWhitespace });
    let oldNum = 1;
    let newNum = 1;
    const data: LineDiff[] = [];
    let collapseIdCounter = 0;

    for (let i = 0; i < diffs.length; i++) {
      const diff = diffs[i];
      const lines = diff.value.split('\n');

      // Remove the last empty line if the string ends with a newline
      if (lines[lines.length - 1] === '') lines.pop();

      if (diff.removed && i + 1 < diffs.length && diffs[i + 1].added) {
        // Handle modifications
        const removedLines = lines;
        const addedLines = diffs[i + 1].value.split('\n');
        if (addedLines[addedLines.length - 1] === '') addedLines.pop();

        const maxLines = Math.max(removedLines.length, addedLines.length);
        for (let j = 0; j < maxLines; j++) {
          data.push({
            oldNum: j < removedLines.length ? oldNum++ : '',
            newNum: j < addedLines.length ? newNum++ : '',
            oldType: 'modifiedLeft',
            newType: 'modifiedRight',
            oldText: j < removedLines.length ? removedLines[j] : '',
            newText: j < addedLines.length ? addedLines[j] : '',
          });
        }
        i++; // Skip the next diff since it's part of the modification
      } else if (diff.added) {
        // Handle added lines
        lines.forEach((lineContent) => {
          data.push({
            oldNum: '',
            newNum: newNum++,
            oldType: 'empty',
            newType: 'added',
            oldText: '',
            newText: lineContent,
          });
        });
      } else if (diff.removed) {
        // Handle removed lines
        lines.forEach((lineContent) => {
          data.push({
            oldNum: oldNum++,
            newNum: '',
            oldType: 'removed',
            newType: 'empty',
            oldText: lineContent,
            newText: '',
          });
        });
      } else {
        // Unchanged lines
        const unchangedLines = lines.map((lineContent): LineDiff => ({
          oldNum: oldNum++,
          newNum: newNum++,
          oldType: 'unchanged',
          newType: 'unchanged',
          oldText: lineContent,
          newText: lineContent,
        }));

        // Handle collapsing for large unchanged blocks in unified view
        if (unchangedLines.length > COLLAPSE_THRESHOLD) {
          const collapseId = collapseIdCounter++;

          // Determine if we're at the top or bottom
          const isAtTop = data.length === 0;
          const isAtBottom = i === diffs.length - 1;

          // Adjust context lines at the start and end
          const startContext = isAtTop ? 0 : CONTEXT_LINES;
          const endContext = isAtBottom ? unchangedLines.length : unchangedLines.length - CONTEXT_LINES;

          // Mark middle lines as hidden
          for (let k = startContext; k < endContext; k++)
            unchangedLines[k].collapseId = collapseId;

          // Calculate number of collapsed lines
          const numCollapsedLines = endContext - startContext;

          // Add an expander after the first context lines (or at the start if at top)
          unchangedLines.splice(startContext, 0, {
            oldNum: '',
            newNum: '',
            oldType: 'expander',
            newType: 'expander',
            oldText: diffs.length !== 1 ? `Expand ${numCollapsedLines} lines` : `Identical (${numCollapsedLines} lines)`,
            newText: '',
            collapseId,
          });
        }

        data.push(...unchangedLines);
      }
    }

    return data;
  }, [ignoreWhitespace, newText, oldText, props.policyUnchangedWhenEmpty]);


  /**
   * Compare two strings and return elements highlighting the differences.
   */
  const renderWordDiffs = React.useCallback((oldStr: string, newStr: string, isLeftSide: boolean) => {
    const wordDiffs = diffChars(oldStr, newStr);

    return wordDiffs
      .map((part, index) => {
        if ((part.added && isLeftSide) || (part.removed && !isLeftSide))
          return null;
        const className =
          part.added ? (!isLeftSide ? 'inserted' : undefined)
            : part.removed ? (isLeftSide ? 'deleted' : undefined)
              : undefined;
        return <span key={index} className={className}>{part.value}</span>;
      })
      .filter(Boolean);
  }, []);


  /**
   * Memo the corner dropdown
   */
  const dropdown = React.useMemo(() => (
    <Dropdown>
      <MenuButton
        aria-label='Diff Menu'
        slots={{ root: IconButton }}
        slotProps={{ root: { size: 'sm' } }}
        sx={{ ml: 'auto', my: -1, mr: -0.5 }}
        className='undo-shade'
      >
        <MoreVertIcon />
      </MenuButton>
      <Menu placement='bottom-end' disablePortal={!isFullscreen ? undefined : true} sx={{ minWidth: 200, zIndex: 1000000 }}>

        {/* Fullscreen */}
        <MenuItem onClick={isFullscreen ? exitFullscreen : enterFullscreen}>
          <ListItemDecorator><ZoomOutMapIcon /></ListItemDecorator>
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </MenuItem>

        <ListDivider />

        {/* Split view button */}
        <MenuItem onClick={() => setViewType(viewType => viewType === 'split' ? 'unified' : 'split')}>
          <ListItemDecorator><Checkbox variant='outlined' checked={viewType === 'split'} /></ListItemDecorator>
          Side-by-side Viewer <FlipIcon sx={{ fontSize: 'md', opacity: 0.5 }} />
        </MenuItem>

        {/* Ignore whitespace button */}
        <MenuItem onClick={() => setIgnoreWhitespace(ignore => !ignore)}>
          <ListItemDecorator><Checkbox variant='outlined' checked={ignoreWhitespace} /></ListItemDecorator>
          Ignore Whitespace <SpaceBarIcon sx={{ fontSize: 'md', opacity: 0.5 }} />
        </MenuItem>

        {/* Wrap text button */}
        <MenuItem onClick={() => setWrapLongLines(wrap => !wrap)}>
          <ListItemDecorator><Checkbox variant='outlined' checked={wrapLongLines} /></ListItemDecorator>
          Soft-wrap Lines <WrapTextIcon sx={{ fontSize: 'md', opacity: 0.5 }} />
        </MenuItem>

        <MenuItem onClick={() => setHighContrast(high => !high)}>
          <ListItemDecorator><Checkbox variant='outlined' checked={highContrast} /></ListItemDecorator>
          High Contrast <ContrastIcon sx={{ fontSize: 'md', opacity: 0.5 }} />
        </MenuItem>

        {/* Shrink height button */}
        {!inModal && !isFullscreen && (
          <MenuItem onClick={() => setShrinkHeight(shrink => !shrink)}>
            <ListItemDecorator><Checkbox variant='outlined' checked={_shrinkHeight} /></ListItemDecorator>
            Enable Scrolling
          </MenuItem>
        )}

        <ListDivider />

        {/* Collapse unchanced */}
        <MenuItem onClick={() => setExpandedBlocks(new Set())}>
          <ListItemDecorator><CompressRoundedIcon /></ListItemDecorator>
          Hide Unchanged Lines
        </MenuItem>

        {/* Expand collapsed sections */}
        <MenuItem onClick={() => setExpandedBlocks(new Set(unifiedDiffData.filter(line => line.collapseId !== undefined).map(line => line.collapseId!)))}>
          <ListItemDecorator><ExpandRoundedIcon /></ListItemDecorator>
          Show All Lines
        </MenuItem>

        <ListDivider />

        {/* Copy options */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MenuItem disabled={!props.oldText} onClick={() => copyToClipboard(props.oldText, typeof props.oldTitle === 'string' ? props.oldTitle : 'Left side content')}>
            <ListItemDecorator><ContentCopyIcon sx={{ fontSize: 'lg' }} /></ListItemDecorator>
            Copy 1
          </MenuItem>
          <MenuItem disabled={!props.newText} onClick={() => copyToClipboard(props.newText, typeof props.newTitle === 'string' ? props.newTitle : 'Right side content')}>
            <ListItemDecorator><ContentCopyIcon sx={{ fontSize: 'lg' }} /></ListItemDecorator>
            Copy 2
          </MenuItem>
        </Box>

      </Menu>
    </Dropdown>
  ), [_shrinkHeight, enterFullscreen, exitFullscreen, highContrast, ignoreWhitespace, inModal, isFullscreen, props.newText, props.newTitle, props.oldText, props.oldTitle, unifiedDiffData, viewType, wrapLongLines]);


  /**
   * Event handler for toggling collapsed blocks.
   */
  const handleToggleCollapse = React.useCallback((collapseId?: number) => {
    if (collapseId === undefined) return;
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(collapseId))
        newSet.delete(collapseId);
      else
        newSet.add(collapseId);
      return newSet;
    });
  }, []);


  // Render the diff viewer
  return (
    <Box ref={fullScreenElementRef} sx={containerStyle}>

      {viewType === 'unified' ? (
        <Box sx={gridStyle}>
          {(!!props.oldTitle || !!props.newTitle) && (
            <>
              <div className='dv-title'></div>
              <div className='dv-title dv-num-right'></div>
              <Box className='dv-title' sx={{ display: 'flex', alignItems: 'center' }}>
                {props.newTitle}
                {dropdown}
              </Box>
            </>
          )}
          {unifiedDiffData.map(({ oldText, newText, oldType, newType, oldNum, newNum, collapseId }, index) => {
            const isExpanded = collapseId !== undefined && expandedBlocks.has(collapseId);

            // Render the 3-Expander line
            if (oldType === 'expander') {
              // Render the collapsed block
              if (!isExpanded) {
                const toggleCollapse = () => handleToggleCollapse(collapseId);
                return (
                  <React.Fragment key={`expander-${index}`}>
                    <div className={`dv-num expander`} onClick={toggleCollapse}>{dotString}</div>
                    <div className={`dv-num dv-num-right expander`} onClick={toggleCollapse}>{dotString}</div>
                    <div className={`dv-line expander`} onClick={toggleCollapse}>{oldText}</div>
                  </React.Fragment>
                );
              }
              // Don't render the expander when expanded
              return null;
            }

            // Skip rendering the line if collapsed
            if (collapseId !== undefined && !isExpanded) return null;

            // Render the normal 3-col line
            const lineType = newType === 'modifiedRight' ? 'modifiedRight' : oldType === 'modifiedLeft' ? 'modified' : newType === 'added' ? 'added' : oldType;
            return (
              <React.Fragment key={index}>
                <div className={`dv-num ${lineType}`}>{oldNum}</div>
                <div className={`dv-num dv-num-right ${lineType}`}>{newNum}</div>
                <div className={`dv-line ${lineType}`}>
                  {(lineType === 'modified' || lineType === 'modifiedRight')
                    ? renderWordDiffs(oldText, newText, false)
                    : (newText || oldText || <br />)}
                </div>
              </React.Fragment>
            );
          })}
        </Box>
      ) : (
        <Box sx={gridStyle}>
          {(!!props.oldTitle || !!props.newTitle) && (
            <>
              <div className='dv-title' style={{ gridColumn: '1 / span 2' }}>{props.oldTitle}</div>
              <Box className='dv-title dv-num-right' sx={{ gridColumn: '3 / span 2', display: 'flex', alignItems: 'center' }}>
                <strong>{props.newTitle}</strong>
                {dropdown}
              </Box>
            </>
          )}
          {unifiedDiffData.map(({ oldText, newText, oldType, newType, oldNum, newNum, collapseId }, index) => {
            const isExpanded = collapseId !== undefined && expandedBlocks.has(collapseId);

            // if updating the right side, dim the left side
            let dimClass = props.updatingRight ? 'dimmed' : '';

            // if updating the right side, don't show large changes below the replacement line on the left side
            // NOTE: the condition at which is happens is the below
            if (props.updatingRight && oldType === 'modifiedLeft' && newType === 'modifiedRight' && !newText) {
              oldType = 'unchanged';
              newType = 'empty';
            }

            // Render the 4-Expander line
            if (oldType === 'expander') {
              // Render the collapsed block
              if (!isExpanded) {
                const toggleCollapse = () => handleToggleCollapse(collapseId);
                return (
                  <React.Fragment key={`expander-${index}`}>
                    <div className={`dv-num ${oldType} ${dimClass} expander`} onClick={toggleCollapse}>{dotString}</div>
                    <div className={`dv-line ${oldType} expander unselectable`} onClick={toggleCollapse}>{oldText}</div>
                    <div className={`dv-num dv-num-right ${newType} expander`} onClick={toggleCollapse}>{dotString}</div>
                    <div className={`dv-line ${newType} expander`} onClick={toggleCollapse}>{oldText}</div>
                  </React.Fragment>
                );
              }
              // Don't render the expander when expanded
              return null;
            }

            // Skip rendering the line if collapsed
            if (collapseId !== undefined && !isExpanded) return null;

            return (
              <React.Fragment key={index}>
                <div className={`dv-num ${oldType} ${dimClass}`}>{oldNum}</div>
                <div className={`dv-line ${oldType} ${dimClass} unselectable`}>
                  {oldType === 'modifiedLeft' && renderWordDiffs(oldText, newText, true)}
                  {(oldType === 'removed' || oldType === 'unchanged') && (oldText || <br />)}
                  {/*{line.oldType === 'empty' && ''}*/}
                </div>
                <div className={`dv-num dv-num-right ${newType}`}>{newNum}</div>
                <div className={`dv-line ${newType}`}>
                  {newType === 'modifiedRight' && renderWordDiffs(oldText, newText, false)}
                  {(newType === 'added' || newType === 'unchanged') && (newText || <br />)}
                  {/*{line.newType === 'empty' && ''}*/}
                </div>
              </React.Fragment>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
