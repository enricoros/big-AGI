import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, IconButton, Typography } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';

import type { ContentScaling } from '~/common/app.theme';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';

import { EnhancedRenderCodeMenu } from './EnhancedRenderCodeMenu';
import { RenderCodeMemo } from './RenderCode';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from './panel/RenderCodePanelFrame';
import { getCodeCollapseManager } from './codeCollapseManager';
import MoreVertIcon from '@mui/icons-material/MoreVert';


export function EnhancedRenderCode(props: {
  semiStableId: string | undefined,

  title: string,
  code: string,
  isPartial: boolean,

  fitScreen?: boolean,
  initialShowHTML?: boolean,
  noCopyButton?: boolean,
  optimizeLightweight?: boolean,

  codeSx?: SxProps,

  language?: string,
  color?: ColorPaletteProp;
  contentScaling: ContentScaling;

  onLiveFileCreate?: () => void,
}) {

  // state
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCodeCollapsed, setIsCodeCollapsed] = React.useState(false);


  // hooks

  const handleToggleCodeCollapse = React.useCallback(() => {
    setIsCodeCollapsed(c => !c);
  }, []);

  const handleCloseContextMenu = React.useCallback(() => setContextMenuAnchor(null), []);

  const handleToggleContextMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setContextMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);


  // effects
  React.useEffect(() => {
    return getCodeCollapseManager().addCollapseAllListener((collapseAll: boolean) => setIsCodeCollapsed(collapseAll));
  }, []);


  // components

  const headerTooltipContents = React.useMemo(() => (
    <Box sx={enhancedCodePanelTitleTooltipSx}>
      {/* This is what we have */}
      <div>Title</div>
      <div>{props.title}</div>
      {/*<div>Language</div>*/}
      {/*<div>{props.language}</div>*/}
      <div>Code Length</div>
      <div>{props.code.length} characters</div>
      <div>Code Lines</div>
      <div>{props.code.split('\n').length} lines</div>
      <div>semiStableId</div>
      <div>{props.semiStableId || '(none)'}</div>
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
  ), [props.code, props.semiStableId, props.title]);

  const headerRow = React.useMemo(() => <>
    {/* Icon and Title */}
    <Typography level='title-sm' startDecorator={<CodeIcon />}>
      <TooltipOutlined placement='top-start' color='neutral' title={headerTooltipContents}>
        {/*<span>{fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref}</span>*/}
        <span>{props.title || 'Code'}</span>
      </TooltipOutlined>
    </Typography>

    {/* Menu Options button */}
    <IconButton
      size='sm'
      onClick={handleToggleContextMenu}
      onContextMenu={handleToggleContextMenu}
    >
      <MoreVertIcon />
    </IconButton>


    {/*/!* Collapsing Button *!/*/}


    {/*<StyledOverlayButton*/}
    {/*  size='sm'*/}
    {/*  variant='plain'*/}
    {/*  color='neutral'*/}
    {/*  onClick={handleToggleCodeCollapse}*/}
    {/*>*/}
    {/*  {isCodeCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}*/}
    {/*</StyledOverlayButton>*/}
  </>, [headerTooltipContents, props.title]);

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
      // onHeaderClick={handleToggleCodeCollapse}
      // onHeaderContext={handleToggleContextMenu}
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
          sx={patchCodeSx}
        />
      </ExpanderControlledBox>

      {/* Context Menu */}
      {contextMenuAnchor && (
        <EnhancedRenderCodeMenu
          anchor={contextMenuAnchor}
          onClose={handleCloseContextMenu}
          isCollapsed={isCodeCollapsed}
          onToggleCollapse={handleToggleCodeCollapse}
        />
      )}

    </RenderCodePanelFrame>
  );
}