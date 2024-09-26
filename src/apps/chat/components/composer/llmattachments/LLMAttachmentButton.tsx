import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, Sheet, Typography, VariantProp } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import CodeIcon from '@mui/icons-material/Code';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import HtmlIcon from '@mui/icons-material/Html';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import PermMediaOutlinedIcon from '@mui/icons-material/PermMediaOutlined';
import PhotoSizeSelectLargeOutlinedIcon from '@mui/icons-material/PhotoSizeSelectLargeOutlined';
import PhotoSizeSelectSmallOutlinedIcon from '@mui/icons-material/PhotoSizeSelectSmallOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import YouTubeIcon from '@mui/icons-material/YouTube';

import { RenderImageURL } from '~/modules/blocks/image/RenderImageURL';

import type { AttachmentDraft, AttachmentDraftConverterType, AttachmentDraftId } from '~/common/attachment-drafts/attachment.types';
import { LiveFileIcon } from '~/common/livefile/liveFile.icons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { ellipsizeFront, ellipsizeMiddle } from '~/common/util/textUtils';

import type { LLMAttachmentDraft } from './useLLMAttachmentDrafts';


// default attachment width
const ATTACHMENT_MIN_STYLE = {
  height: '100%',
  minHeight: '40px',
  // commented, this is messing with the style
  // minWidth: '64px',
};


const ellipsizeLabel = (label?: string) => {
  if (!label)
    return '';
  return ellipsizeMiddle((label || '')
    .replace(/https?:\/\/(?:www\.)?/, ''), 30)
    .replace(/\/$/, '')
    .replace('…', '…\n…');
};


/**
 * Displayed while a source is loading
 */
function InputLoadingPlaceholder(props: { label: string }) {
  return <Sheet
    color='success' variant='soft'
    sx={{
      border: '1px solid',
      borderColor: 'success.solidBg',
      borderRadius: 'sm',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
      ...ATTACHMENT_MIN_STYLE,
      boxSizing: 'border-box',
      px: 1, py: 0.5, // reduce
    }}
  >
    <CircularProgress color='success' size='sm' />
    <Typography level='title-sm' sx={{ whiteSpace: 'nowrap' }}>
      {ellipsizeLabel(props.label)}
    </Typography>
  </Sheet>;
}

/**
 * Displayed when there is an error loading the input (e.g. file does not exist)
 */
function InputErrorIndicator() {
  return <WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />;
}


const converterTypeToIconMap: { [key in AttachmentDraftConverterType]: React.ComponentType<any> | null } = {
  'text': TextFieldsIcon,
  'rich-text': CodeIcon,
  'rich-text-cleaner': CodeIcon,
  'rich-text-table': PivotTableChartIcon,
  'image-original': ImageOutlinedIcon,
  'image-resized-high': PhotoSizeSelectLargeOutlinedIcon,
  'image-resized-low': PhotoSizeSelectSmallOutlinedIcon,
  'image-to-default': ImageOutlinedIcon,
  'image-ocr': AbcIcon,
  'pdf-text': PictureAsPdfIcon,
  'pdf-images': PermMediaOutlinedIcon,
  'pdf-text-and-images': PermMediaOutlinedIcon,
  'docx-to-html': DescriptionOutlinedIcon,
  'url-page-text': TextFieldsIcon, // was LanguageIcon
  'url-page-markdown': CodeIcon, // was LanguageIcon
  'url-page-html': HtmlIcon, // was LanguageIcon
  'url-page-null': TextureIcon,
  'url-page-image': ImageOutlinedIcon,
  'youtube-transcript': YouTubeIcon,
  'youtube-transcript-simple': YouTubeIcon,
  'ego-fragments-inlined': TelegramIcon,
  'unhandled': TextureIcon,
};

function attachmentIcons(attachmentDraft: AttachmentDraft): React.ReactNode {
  const activeConterters = attachmentDraft.converters.filter(c => c.isActive);
  if (activeConterters.length === 0)
    return null;

  // find an icon for the first active converter
  // Note: commented on 2024-07-16 because not tested enough
  // const imageDataRefs = attachmentDraft.outputFragments.map(f => {
  //   if (!isImageRefPart(f.part))
  //     return null;
  //   const dataRef = f.part.dataRef;
  //   if (!dataRef || dataRef.reftype !== 'dblob')
  //     return null;
  //   return dataRef;
  // }).filter(Boolean);

  // 1+ icons
  return <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>

    {/* If we have a Web preview, show it first */}
    {!!attachmentDraft.input?.urlImage?.imgDataUrl && /*!imageDataRefs.length &&*/ (
      // <Tooltip title={<>This was the page.<br />You can also Add the Screenshot as attachment</>}>
      <RenderImageURL
        imageURL={attachmentDraft.input.urlImage.imgDataUrl}
        variant='attachment-button'
        scaledImageSx={{ width: 28, height: 28 }}
      />
      // </Tooltip>
    )}

    {/* If an output fragment contains a base64 image, show that as an icon too */}
    {/*{imageDataRefs.map((dataRef, i) => dataRef && (*/}
    {/*  <RenderImageRefDBlob*/}
    {/*    key={i}*/}
    {/*    dataRefDBlobAssetId={dataRef.dblobAssetId}*/}
    {/*    dataRefMimeType={dataRef.mimeType}*/}
    {/*    variant='attachment-button'*/}
    {/*    scaledImageSx={{ width: 28, height: 28 }}*/}
    {/*  />*/}
    {/*))}*/}

    {/*{activeConterters.some(c => c.id.startsWith('url-page-')) ? <LanguageIcon sx={{ opacity: 0.2, ml: -2.5 }} /> : null}*/}
    {activeConterters.map((_converter, idx) => {
      const Icon = converterTypeToIconMap[_converter.id] ?? null;
      return !Icon ? null : (
        <TooltipOutlined key={`${_converter.id}-${idx}`} title={`Attached as ${_converter.name}`} placement='top-start'>
          <Icon sx={{ width: 20, height: 20 }} />
        </TooltipOutlined>
      );
    })}
  </Box>;
}

function attachmentLabelText(attachmentDraft: AttachmentDraft): string {
  const converter = attachmentDraft.converters.find(c => c.isActive) ?? null;
  if (converter && attachmentDraft.label === 'Rich Text') {
    if (converter.id === 'rich-text-table')
      return 'Rich Table';
    if (converter.id === 'rich-text-cleaner')
      return 'Clean HTML';
    if (converter.id === 'rich-text')
      return 'Rich HTML';
  }
  return ellipsizeFront(attachmentDraft.label, 22);
}


export const LLMAttachmentButtonMemo = React.memo(LLMAttachmentButton);

function LLMAttachmentButton(props: {
  llmAttachment: LLMAttachmentDraft,
  menuShown: boolean,
  onToggleMenu: (attachmentDraftId: AttachmentDraftId, anchor: HTMLAnchorElement) => void,
}) {

  // derived state
  const { attachmentDraft: draft, llmSupportsAllFragments } = props.llmAttachment;

  const isInputLoading = draft.inputLoading;
  const isInputError = !!draft.inputError;
  const isUnconvertible = !draft.converters.length;
  const isOutputLoading = draft.outputsConverting;
  const isOutputMissing = !draft.outputFragments.length;
  const hasLiveFiles = draft.outputFragments.some(_f => _f.liveFileId);

  const showWarning = isUnconvertible || (isOutputMissing || !llmSupportsAllFragments);


  // handlers

  const { onToggleMenu } = props;

  const handleToggleMenu = React.useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault(); // added for the Right mouse click (to prevent the menu)
    onToggleMenu(draft.id, event.currentTarget);
  }, [draft.id, onToggleMenu]);

  // choose variants and color
  const color: ColorPaletteProp =
    (isInputLoading || isOutputLoading) ? 'success'
      : isInputError ? 'danger'
        : showWarning ? 'warning'
          : /*props.menuShown ? 'primary' :*/ 'neutral';

  const variant: VariantProp =
    (isInputLoading || isOutputLoading || isInputError || showWarning) ? 'soft'
      : 'outlined';

  // loading indicator before we are ready for a button
  if (isInputLoading)
    return <InputLoadingPlaceholder label={draft.label} />;

  return (
    <Button
      size='sm'
      color={color}
      variant={variant}
      onClick={handleToggleMenu}
      onContextMenu={handleToggleMenu}
      sx={{
        backgroundColor: props.menuShown ? `${color}.softActiveBg` : variant === 'outlined' ? 'background.popup' : undefined,
        border: variant === 'soft' ? '1px solid' : undefined,
        borderColor: variant === 'soft' ? `${color}.solidBg` : undefined,
        borderRadius: 'sm',
        ...ATTACHMENT_MIN_STYLE,
        px: 1, py: 0.5, // reduce
        gap: 1,
      }}
    >

      {isInputError && <InputErrorIndicator />}

      {/* Icons: Web Page Screenshot, Converter[s] */}
      {attachmentIcons(draft)}

      {/* Label */}
      <Typography level='title-sm' sx={{ whiteSpace: 'nowrap' }}>
        {isOutputLoading ? 'Converting... ' : attachmentLabelText(draft)}
      </Typography>

      {/* Is Converting icon */}
      {isOutputLoading && <CircularProgress color='success' size='sm' />}

      {/* LiveFile is supported icon */}
      {hasLiveFiles && (
        <TooltipOutlined title='LiveFile is supported' placement='top-end'>
          <LiveFileIcon />
        </TooltipOutlined>
      )}

    </Button>
  );
}