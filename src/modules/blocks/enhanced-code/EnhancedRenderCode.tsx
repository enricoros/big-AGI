import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, IconButton, Typography } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import type { ContentScaling } from '~/common/app.theme';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import { EnhancedRenderCodeMenu } from './EnhancedRenderCodeMenu';
import { RenderCodeMemo } from '../code/RenderCode';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from '../code/RenderCodePanelFrame';
import { getCodeCollapseManager } from './codeCollapseManager';
import { useLiveFilePatch } from './livefile-patch/useLiveFilePatch';


export function EnhancedRenderCode(props: {
  semiStableId: string | undefined,

  title: string,
  code: string,
  isPartial: boolean,

  fitScreen: boolean,
  isMobile: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,

  codeSx?: SxProps,

  language?: string,
  color?: ColorPaletteProp;
  contentScaling: ContentScaling;
  initialIsCollapsed: boolean;

  // onLiveFileCreate?: () => void,
  onReplaceInCode?: (search: string, replace: string) => boolean;
}) {

  // state
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCodeCollapsed, setIsCodeCollapsed] = React.useState(props.initialIsCollapsed);

  // LiveFile - patch state
  const { button: liveFileButton, actionBar: liveFileActionBar } = useLiveFilePatch(
    props.title, props.code, props.isPartial,
    props.isMobile,
  );


  // React to changes in the collapsed state. Note that by default, nothing is collapsed
  React.useEffect(() => {
    setIsCodeCollapsed(props.initialIsCollapsed);
  }, [props.initialIsCollapsed]);


  // handlers

  const handleCloseContextMenu = React.useCallback(() => setContextMenuAnchor(null), []);

  const handleToggleCodeCollapse = React.useCallback(() => {
    setIsCodeCollapsed(c => !c);
    handleCloseContextMenu();
  }, [handleCloseContextMenu]);

  const handleToggleContextMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    event.stopPropagation();
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

  const headerTooltipContents = React.useMemo(() => (
    <Box sx={enhancedCodePanelTitleTooltipSx}>
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
    </Box>
  ), [props.code, props.isPartial, props.semiStableId, props.title]);

  const headerRow = React.useMemo(() => {
    const Icon = CodeIcon;
    return <>
      {/* Icon and Title */}
      <TooltipOutlined placement='top-start' color='neutral' title={headerTooltipContents}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon
            aria-hidden
            onClick={handleToggleCodeCollapse}
            sx={{
              transform: isCodeCollapsed ? 'rotate(-90deg)' : 'none',
              transition: 'transform 0.2s cubic-bezier(.17,.84,.44,1)',
              cursor: 'pointer',
            }}
          />
          <Typography level={'title-sm'}>
            {props.title || 'Code'}
          </Typography>
        </Box>
      </TooltipOutlined>

      {/* LiveFile - Select */}
      {liveFileButton}

      {/* Menu Options button */}
      <IconButton
        size='sm'
        onClick={handleToggleContextMenu}
        onContextMenu={handleToggleContextMenu}
        sx={{ mr: -0.5 }}
      >
        <MoreVertIcon />
      </IconButton>

    </>;
  }, [handleToggleCodeCollapse, handleToggleContextMenu, headerTooltipContents, isCodeCollapsed, liveFileButton, props.title]);

  // const toolbarRow = React.useMemo(() => <>
  //   {props.onLiveFileCreate && (
  //     <Button
  //       size='sm'
  //       variant='outlined'
  //       color='neutral'
  //       startDecorator={<LiveHelpIcon />}
  //       onClick={props.onLiveFileCreate}
  //     >
  //       Create Live File
  //     </Button>
  //   )}
  //   {/* Add more toolbar items here */}
  // </>, [props.onLiveFileCreate]);


  // styles

  const patchCodeSx = React.useMemo(() => ({
    ...props.codeSx,
    my: 0,
    borderTop: '1px solid',
    borderTopColor: `neutral.outlinedBorder`,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  }), [props.codeSx]);


  return (
    <RenderCodePanelFrame
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
      <ExpanderControlledBox expanded={!isCodeCollapsed}>
        <RenderCodeMemo
          semiStableId={props.semiStableId}
          code={props.code} title={props.title} isPartial={props.isPartial}
          fitScreen={props.fitScreen}
          initialShowHTML={props.initialShowHTML}
          noCopyButton={props.noCopyButton}
          optimizeLightweight={props.optimizeLightweight}
          onReplaceInCode={props.onReplaceInCode}
          sx={patchCodeSx}
        />
      </ExpanderControlledBox>

      {/* Context Menu */}
      {contextMenuAnchor && (
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