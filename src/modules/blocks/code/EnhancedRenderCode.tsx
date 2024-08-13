import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, IconButton, Typography } from '@mui/joy';
import CodeIcon from '@mui/icons-material/Code';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import type { ContentScaling } from '~/common/app.theme';
import type { LiveFileId } from '~/common/livefile/liveFile.types';
import { ExpanderControlledBox } from '~/common/components/ExpanderControlledBox';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useContextWorkspaceId } from '~/common/stores/workspace/WorkspaceIdProvider';
import { useLiveFileSync } from '../../../apps/chat/components/message/fragments-attachment-doc/livefile-sync/useLiveFileSync';

import { EnhancedRenderCodeMenu } from './EnhancedRenderCodeMenu';
import { RenderCodeMemo } from './RenderCode';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from './RenderCodePanelFrame';
import { getCodeCollapseManager } from './codeCollapseManager';


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

  // onLiveFileCreate?: () => void,
}) {

  // state
  const [contextMenuAnchor, setContextMenuAnchor] = React.useState<HTMLElement | null>(null);
  const [isCodeCollapsed, setIsCodeCollapsed] = React.useState(false);

  // external state
  const workspaceId = useContextWorkspaceId();


  // LiveFile sync

  // const handleReplaceDocFragmentText = React.useCallback((newText: string) => {
  //   // create a new Doc Attachment Fragment
  //   const newData = createDMessageDataInlineText(newText, fragmentDocPart.data.mimeType);
  //   const newAttachment = createDocAttachmentFragment(fragmentTitle, fragment.caption, fragmentDocPart.vdt, newData, fragmentDocPart.ref, fragmentDocPart.meta, fragment.liveFileId);
  //
  //   // reuse the same fragment ID, which makes the screen not flash (otherwise the whole editor would disappear as the ID does not exist anymore)
  //   newAttachment.fId = fragmentId;
  //
  //   // replace this fragment with the new one
  //   onFragmentReplace(fragmentId, newAttachment);
  // }, [fragment.caption, fragment.liveFileId, fragmentDocPart, fragmentId, fragmentTitle, onFragmentReplace]);

  /* Very Local State
   * this will easily get wiped just on a component remount - so it's just a temporary 'solution'.
   */
  const [liveFileId, setLiveFileId] = React.useState<LiveFileId | null>(null);

  console.warn('TODO: from here!')

  const { liveFileControlButton, liveFileActions } = useLiveFileSync(
    liveFileId,
    workspaceId,
    props.fitScreen === true, // as a proxy for isMobile
    props.code,
    setLiveFileId,
    (text: string) => null,
  );


  // hooks

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
      <div>Title</div>
      <div>{props.title || '(empty)'}</div>
      {/*<div>Language</div>*/}
      {/*<div>{props.language}</div>*/}
      <div>Code Lines</div>
      <div>{props.code.split('\n').length} lines</div>
      <div>Code Length</div>
      <div>{props.code.length} characters</div>
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
    <TooltipOutlined placement='top-start' color='neutral' title={headerTooltipContents}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CodeIcon
          aria-hidden
          onClick={handleToggleCodeCollapse}
          sx={{
            transform: isCodeCollapsed ? 'rotate(-90deg)' : 'none',
            transition: 'transform 0.2s cubic-bezier(.17,.84,.44,1)',
            cursor: 'pointer',
          }}
        />
        <Typography level='title-sm'>
          {props.title || 'Code'}
        </Typography>
      </Box>
    </TooltipOutlined>

    {/* LiveFile */}
    <Box sx={{ ml: 'auto' }}>
      {liveFileControlButton}
    </Box>

    {/* Menu Options button */}
    <IconButton
      size='sm'
      onClick={handleToggleContextMenu}
      onContextMenu={handleToggleContextMenu}
      sx={{ mr: -0.5 }}
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
  </>, [handleToggleCodeCollapse, handleToggleContextMenu, headerTooltipContents, isCodeCollapsed, liveFileControlButton, props.title]);

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
      subHeaderInline={liveFileActions}
      onHeaderClick={props.fitScreen ? handleToggleCodeCollapse : undefined}
      onHeaderContext={handleToggleContextMenu}
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