import * as React from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, ColorPaletteProp, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CodeIcon from '@mui/icons-material/Code';

import type { ContentScaling } from '~/common/app.theme';
import { CloseableMenu } from '~/common/components/CloseableMenu';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { useUXLabsStore } from '~/common/state/store-ux-labs';

import { RenderCodeMemo } from './RenderCode';
import { enhancedCodePanelTitleTooltipSx, RenderCodePanelFrame } from './panel/RenderCodePanelFrame';


/**
 * Small hidden context menu to toggle the code enhancer, globally.
 */
function CodeEnhancerMenu(props: { anchor: HTMLElement, onClose: () => void }) {

  // state
  const { labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks } = useUXLabsStore(useShallow(state => ({
    labsEnhanceCodeBlocks: state.labsEnhanceCodeBlocks,
    setLabsEnhanceCodeBlocks: state.setLabsEnhanceCodeBlocks,
  })));

  const toggleEnhanceCodeBlocks = React.useCallback(() => {
    // turn blocks on (may not even be called, ever)
    if (!labsEnhanceCodeBlocks) {
      setLabsEnhanceCodeBlocks(true);
      return;
    }
    // ask to turn the blocks off
    // showPromisedOverlay('') ...
    setLabsEnhanceCodeBlocks(false);
  }, [labsEnhanceCodeBlocks, setLabsEnhanceCodeBlocks]);

  return (
    <CloseableMenu
      dense
      open anchorEl={props.anchor} onClose={props.onClose}
      sx={{ minWidth: 280 }}
    >

      {/* A mix in between UxLabsSettings (labsEnhanceCodeBlocks) and the ChatDrawer MenuItems */}
      <MenuItem onClick={toggleEnhanceCodeBlocks}>
        <ListItemDecorator>{labsEnhanceCodeBlocks && <CheckRoundedIcon />}</ListItemDecorator>
        Enhance Legacy Code <CodeIcon />
      </MenuItem>

    </CloseableMenu>
  );
}


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
  // const [isCopied, setIsCopied] = React.useState(false);


  // const handleCopyToClipboard = () => {
  //   copyToClipboard(props.code, 'Code');
  //   setIsCopied(true);
  //   setTimeout(() => setIsCopied(false), 2000);
  // };
  //
  // const handleDownload = () => {
  //   const blob = new Blob([props.code], { type: 'text/plain' });
  //   const url = URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.href = url;
  //   a.download = `${props.title || 'code'}.${props.language}`;
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  //   URL.revokeObjectURL(url);
  // };

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

    <Typography level='title-sm' startDecorator={<CodeIcon />}>
      <TooltipOutlined placement='top-start' color='neutral' title={headerTooltipContents}>
        {/*<span>{fragmentDocPart.meta?.srcFileName || fragmentDocPart.l1Title || fragmentDocPart.ref}</span>*/}
        <span>{props.title || 'Code'}</span>
      </TooltipOutlined>
    </Typography>

    {/*<Box sx={{ display: 'flex', gap: 1 }}>*/}
    {/*  {!props.noCopyButton && (*/}
    {/*    <Tooltip title={isCopied ? 'Copied!' : 'Copy code'} variant='solid'>*/}
    {/*      <IconButton*/}
    {/*        size='sm'*/}
    {/*        variant='outlined'*/}
    {/*        color={isCopied ? 'success' : 'neutral'}*/}
    {/*        onClick={handleCopyToClipboard}*/}
    {/*      >*/}
    {/*        <ContentCopyIcon />*/}
    {/*      </IconButton>*/}
    {/*    </Tooltip>*/}
    {/*  )}*/}
    {/*  <Tooltip title='Download code' variant='solid'>*/}
    {/*    <IconButton*/}
    {/*      size='sm'*/}
    {/*      variant='outlined'*/}
    {/*      color='neutral'*/}
    {/*      onClick={handleDownload}*/}
    {/*    >*/}
    {/*      <FileDownloadIcon />*/}
    {/*    </IconButton>*/}
    {/*  </Tooltip>*/}
    {/*</Box>*/}
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


  const handleCloseContextMenu = React.useCallback(() => setContextMenuAnchor(null), []);

  const handleToggleContextMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    setContextMenuAnchor(anchor => anchor ? null : event.currentTarget);
  }, []);


  return (
    <RenderCodePanelFrame
      color={props.color || 'neutral'}
      gutterBlock
      noOuterShadow
      contentScaling={props.contentScaling}
      headerRow={headerRow}
      // subHeaderInline={subHeaderInline}
      // toolbarRow={toolbarRow}
      onContextMenu={handleToggleContextMenu}
    >

      <RenderCodeMemo
        semiStableId={props.semiStableId}
        code={props.code} title={props.title} isPartial={props.isPartial}
        fitScreen={props.fitScreen}
        initialShowHTML={props.initialShowHTML}
        noCopyButton={props.noCopyButton}
        optimizeLightweight={props.optimizeLightweight}
        sx={props.codeSx}
      />

      {/* Context Menu */}
      {contextMenuAnchor && (
        <CodeEnhancerMenu
          anchor={contextMenuAnchor}
          onClose={handleCloseContextMenu}
        />
      )}

    </RenderCodePanelFrame>
  );
}