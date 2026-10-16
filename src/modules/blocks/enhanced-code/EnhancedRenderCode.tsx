import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, IconButton, Typography } from '@mui/joy';
import BarChartIcon from '@mui/icons-material/BarChart';
import CodeIcon from '@mui/icons-material/Code';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import type { ContentScaling } from '~/common/app.theme';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import { BLOCK_CODE_FALLBACK_TITLE, BLOCK_CODE_VND_AGI_CHARTJS, RenderCodeMemo } from '../code/RenderCode';
import { EnhancedRenderCodeMenu } from './EnhancedRenderCodeMenu';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from '../code/RenderCodePanelFrame';
import { getCodeCollapseManager } from './codeCollapseManager';
import { useLiveFilePatch } from './livefile-patch/useLiveFilePatch';


const _styles = {
  headerIcon: {
    mr: -0.5,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    overflow: 'hidden',
  },
} as const satisfies Record<string, SxProps>;


// Named Profiler boundaries; the existing useMemo calls keep their JSX stable.
function ERCHeaderTooltip(props: { children: React.ReactNode }) {
  return props.children;
}

function ERCHeader(props: { children: React.ReactNode }) {
  return props.children;
}


export function EnhancedRenderCode(props: {
  // same as RenderCode
  semiStableId: string | undefined,
  title: string,
  code: string,
  isPartial: boolean,
  fitScreen: boolean,
  initialRenderHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,
  onReattachAsFile?: (file: File) => void;
  onReplaceInCode?: (search: string, replace: string) => boolean;
  codeSx?: SxProps,
  // enhanced props
  color?: ColorPaletteProp;
  contentScaling: ContentScaling;
  initialIsCollapsed: boolean;
  isMobile: boolean,
  noApplyButton?: boolean,
  frameless?: boolean, // hide the frame without remounting the renderer
}) {

  // state
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCodeCollapsed, setIsCodeCollapsed] = React.useState(props.initialIsCollapsed);

  // LiveFile - patch state
  const { button: liveFileButton, actionBar: liveFileActionBar } = useLiveFilePatch(
    props.title, props.code, props.isPartial,
    props.isMobile, !!props.noApplyButton,
  );


  // React to changes in the collapsed state. Note that by default, nothing is collapsed
  // Reset collapse and dismiss hidden menus when the frame changes, as the former remount did.
  React.useEffect(() => {
    setIsCodeCollapsed(props.initialIsCollapsed);
    if (props.frameless) setContextMenuAnchor(null);
  }, [props.frameless, props.initialIsCollapsed]);


  // handlers

  const handleCloseContextMenu = React.useCallback(() => setContextMenuAnchor(null), []);

  const handleToggleCodeCollapse = React.useCallback(() => {
    setIsCodeCollapsed(c => !c);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleToggleContextMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)

    // NOTE: disabled because a click here won't close other menus (won't trigger other component's ClickAwayListeners)
    // event.stopPropagation();

    setContextMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);


  // effects
  React.useEffect(() => {
    return getCodeCollapseManager().addCollapseAllListener((collapseAll: boolean) => {
      setIsCodeCollapsed(collapseAll);
      handleCloseContextMenu();
    });
  }, [handleCloseContextMenu]);


  // components

  const headerTooltipContents = React.useMemo(() => {
    // Skip the whole-code line count while the header is hidden during streaming.
    if (props.frameless) return null;
    return <ERCHeaderTooltip><Box sx={enhancedCodePanelTitleTooltipSx}>
      {/* This is what we have */}
      <div><strong>Code Block</strong></div>
      <div></div>
      <div>{props.isPartial ? 'Partial ' : 'Complete'}</div>
      <div></div>
      <div>Title</div>
      <div>{props.title || '(empty)'}</div>
      <div>Version</div>
      <div>{/* TODO props.version ||*/ '(none)'}</div>
      {/*<div>Language</div>*/}
      {/*<div>{props.language}</div>*/}
      <div>Code Lines</div>
      <div>{props.code.split('\n').length} lines</div>
      <div>Characters</div>
      <div>{props.code.length}</div>
      <div>tempId</div>
      <div><small>{props.semiStableId || '(none)'}</small></div>
      {/* This is what attachments carry */}
      {/*<div>Attachment Title</div>*/}
      {/*<div>{fragment.title}</div>*/}
      {/*<div>Doc Title</div>*/}
      {/*<div>{fragmentDocPart.l1Title}</div>*/}
      {/*<div>Identifier</div>*/}
      {/*<div>{fragmentDocPart.ref}</div>*/}
      {/*<div>Render type</div>*/}
      {/*<div>{fragmentDocPart.vdt}</div>*/}
      {/*<div>Text Mime type</div>*/}
      {/*<div>{fragmentDocPart.data?.mimeType || '(unknown)'}</div>*/}
      {/*<div>Text Buffer Id</div>*/}
      {/*<div>{fragmentId}</div>*/}
    </Box></ERCHeaderTooltip>;
  }, [props.code, props.frameless, props.isPartial, props.semiStableId, props.title]);

  const headerRow = React.useMemo(() => {
    if (props.frameless) return null;
    const isChart = props.title === BLOCK_CODE_VND_AGI_CHARTJS;
    const Icon = (isChart && !isCodeCollapsed) ? BarChartIcon : CodeIcon;
    return <ERCHeader>
      {/* Icon and Title */}
      <TooltipOutlined placement='top-start' color='neutral' title={headerTooltipContents}>
        <Box sx={_styles.headerTitle}>
          <IconButton
            aria-label={isCodeCollapsed ? 'Expand code block' : 'Collapse code block'}
            aria-expanded={!isCodeCollapsed}
            size='sm'
            variant={isCodeCollapsed ? 'outlined' : 'soft'}
            onClick={handleToggleCodeCollapse}
            sx={{
              ml: -0.5,
              backgroundColor: 'transparent',
              '&:hover': { backgroundColor: 'background.popup' },
            }}
          >
            <Icon sx={{
              transform: (isCodeCollapsed && !isChart) ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.2s cubic-bezier(.17,.84,.44,1)',
            }} />
          </IconButton>
          <Typography level={!isChart ? 'title-sm' : 'body-sm'} className='agi-ellipsize'>
            {isChart ? 'Chart ' + (props.isPartial ? '.'.repeat(Math.round(props.code.length / 100) % 4) : '')
              : props.title === 'markdown' ? ''
                : props.title || BLOCK_CODE_FALLBACK_TITLE}
          </Typography>
        </Box>
      </TooltipOutlined>

      {/* LiveFile - Select */}
      {liveFileButton}

      {/* Menu Options button */}
      <IconButton
        aria-label='Code block options'
        size='sm'
        onClick={handleToggleContextMenu}
        // onContextMenu={handleToggleContextMenu} // NOTE: disabled because onContextMenu prevents */ClickAwayListeners
        sx={_styles.headerIcon}
      >
        <MoreVertIcon />
      </IconButton>

    </ERCHeader>;
  }, [handleToggleCodeCollapse, handleToggleContextMenu, headerTooltipContents, isCodeCollapsed, liveFileButton, props.code.length, props.frameless, props.isPartial, props.title]);


  // styles

  const patchedCodeSx = React.useMemo(() => ({
    ...props.codeSx,
    my: 0,
    borderTop: '1px solid',
    borderTopColor: `neutral.outlinedBorder`,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  }), [props.codeSx]);

  // The frame carries the gutter; the code block keeps its own appearance.
  const framelessCodeSx = React.useMemo(() => ({ ...props.codeSx, my: 0 }), [props.codeSx]);


  return (
    <RenderCodePanelFrame
      frameless={props.frameless}
      color={props.color || 'neutral'}
      gutterBlock
      noOuterShadow
      contentScaling={props.contentScaling}
      headerRow={headerRow}
      subHeaderInline={liveFileActionBar}
      onHeaderClick={/*props.isMobile ? handleToggleCodeCollapse :*/ undefined}
      // onHeaderContext={handleToggleContextMenu} // disabled because ERC got larger, and this will intercept it all
    >

      {/* Body of the message (it's a RenderCode with patched sx, for looks) */}
      <ExpanderControlledBox noContain={true /* Important, allow fixed positioning on OverlayButttons */} expanded={!!props.frameless || !isCodeCollapsed}>
        <RenderCodeMemo
          semiStableId={props.semiStableId}
          code={props.code} title={props.title} isPartial={props.isPartial}
          fitScreen={props.fitScreen}
          initialRenderHTML={props.initialRenderHTML}
          noCopyButton={props.noCopyButton}
          optimizeLightweight={props.optimizeLightweight}
          onReattachAsFile={props.onReattachAsFile}
          onReplaceInCode={props.onReplaceInCode}
          renderHideTitle={!props.frameless /* the header shows it, when there is one */}
          sx={props.frameless ? framelessCodeSx : patchedCodeSx}
        />
      </ExpanderControlledBox>

      {/* Context Menu */}
      {contextMenuAnchor && !props.frameless && (
        <EnhancedRenderCodeMenu
          anchor={contextMenuAnchor}
          code={props.code} title={props.title}
          onClose={handleCloseContextMenu}
          isCollapsed={isCodeCollapsed}
          onToggleCollapse={handleToggleCodeCollapse}
        />
      )}

    </RenderCodePanelFrame>
  );
}

export const EnhancedRenderCodeMemo = React.memo(EnhancedRenderCode);
