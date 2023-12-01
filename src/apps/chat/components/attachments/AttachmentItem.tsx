import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, ListDivider, ListItemDecorator, MenuItem, Radio, Sheet, Typography } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { copyToClipboard } from '~/common/util/clipboardUtils';
import { ellipsizeFront, ellipsizeMiddle } from '~/common/util/textUtils';

import { Attachment, AttachmentConversionType, useAttachmentsStore } from './store-attachments';


// enable for debugging
const DEBUG_ATTACHMENTS = true;

// default attachment width
const ATTACHMENT_MIN_STYLE = {
  height: '100%',
  minHeight: '36px',
  minWidth: '64px',
};


const ellipsizeLabel = (label?: string) => {
  if (!label)
    return '';
  return ellipsizeMiddle((label || '').replace(/https?:\/\/(?:www\.)?/, ''), 30).replace('…', '…\n…');
};


/**
 * Displayed while a source is loading
 */
const LoadingIndicator = React.forwardRef((props: { label: string }, _ref) =>
  <Sheet
    color='success' variant='soft'
    sx={{
      border: '1px solid',
      borderColor: 'success.solidBg',
      borderRadius: 'sm',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
      ...ATTACHMENT_MIN_STYLE,
      boxSizing: 'border-box',
      px: 1,
      py: 0.5,
    }}
  >
    <CircularProgress color='success' size='sm' />
    <Typography level='title-sm' sx={{ whiteSpace: 'nowrap' }}>
      {ellipsizeLabel(props.label)}
    </Typography>
  </Sheet>,
);
LoadingIndicator.displayName = 'LoadingIndicator';


const InputErrorIndicator = () =>
  <WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />;


const conversionTypeToIconMap: { [key in AttachmentConversionType]: React.ComponentType<any> } = {
  'text': TextFieldsIcon,
  'rich-text': CodeIcon,
  'rich-text-table': PivotTableChartIcon,
  'pdf-text': PictureAsPdfIcon,
  'pdf-images': PictureAsPdfIcon,
  'image': ImageOutlinedIcon,
  'image-ocr': AbcIcon,
  'unhandled': TextureIcon,
};

function attachmentIcon(attachment: Attachment) {
  const conversion = attachment.conversionIdx !== null ? attachment.conversions[attachment.conversionIdx] ?? null : null;
  if (conversion && conversion.id) {
    const Icon = conversionTypeToIconMap[conversion.id] ?? null;
    if (Icon)
      return <Icon sx={{ width: 24, height: 24 }} />;
  }
  return null;
}


function attachmentText(attachment: Attachment): string {
  return ellipsizeFront(attachment.label, 24);
}


export function AttachmentItem(props: {
  attachment: Attachment,
  isPositionFirst: boolean,
  isPositionLast: boolean,
  onAttachmentInline: (attachmentId: string) => void,
}) {

  // state
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { attachment } = props;
  const {
    id: aId,
    label: aLabel,
    input: aInput,
    conversions: aConversions,
    conversionIdx: aConversionIdx,
    outputs: aOutputs,
  } = attachment;

  // menu

  const handleMenuHide = () => setMenuAnchor(null);

  const handleMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // operations

  const { onAttachmentInline } = props;

  const handleInline = React.useCallback(() => {
    handleMenuHide();
    onAttachmentInline(aId);
  }, [onAttachmentInline, aId]);

  const handleMoveUp = React.useCallback(() => {
    useAttachmentsStore.getState().moveAttachment(aId, -1);
  }, [aId]);

  const handleMoveDown = React.useCallback(() => {
    useAttachmentsStore.getState().moveAttachment(aId, 1);
  }, [aId]);

  const handleRemove = React.useCallback(() => {
    handleMenuHide();
    useAttachmentsStore.getState().removeAttachment(aId);
  }, [aId]);

  const handleSetConversionIdx = React.useCallback(async (conversionIdx: number | null) =>
      useAttachmentsStore.getState().setConversionIdx(aId, conversionIdx)
    , [aId]);

  const handleCopyOutputToClipboard = React.useCallback(() => {
    if (aOutputs && aOutputs.length >= 1) {
      const concat = aOutputs.map(output => output.text).join('\n');
      copyToClipboard(concat, 'Converted attachment');
    }
  }, [aOutputs]);


  const isUnmoveable = props.isPositionFirst && props.isPositionLast;

  const isInputLoading = attachment.inputLoading;
  const isInputError = !!attachment.inputError;
  const hasInput = !!aInput;

  const isUnconverted = aConversions.length === 0;

  const isNoOutput = aOutputs?.length === 0;
  // const areOutputsEjectable = hasOutputs && aOutputs?.every(output => output.isEjectable);


  let variant: 'soft' | 'outlined' | 'contained';
  let color: ColorPaletteProp;

  // compose tooltip
  let tooltip: string | null = '';
  if (props.attachment.source.media !== 'text')
    tooltip += props.attachment.source.media + ': ';
  tooltip += aLabel;
  // if (hasInput)
  //   tooltip += `\n(${aInput.mimeType}: ${aInput.dataSize.toLocaleString()} bytes)`;
  // if (aOutputs && aOutputs.length >= 1)
  //   tooltip += `\n\n${JSON.stringify(aOutputs)}`;

  if (isInputLoading) {
    variant = 'soft';
    color = 'success';
  } else if (isInputError) {
    tooltip = `Issue loading the attachment: ${attachment.inputError}\n\n${tooltip}`;
    variant = 'soft';
    color = 'danger';
  } else if (isUnconverted) {
    tooltip = `Attachments of type '${aInput?.mimeType}' are not supported yet. You can open a feature request on GitHub.\n\n${tooltip}`;
    variant = 'soft';
    color = 'warning';
  } else if (isNoOutput) {
    tooltip = 'Not compatible with the selected LLM or not supported. Please select another format.\n\n' + tooltip;
    variant = 'soft';
    color = 'warning';
  } else {
    // all good
    tooltip = null;
    variant = 'outlined';
    color = /*menuAnchor ? 'primary' :*/ 'neutral';
  }


  return <Box>

    <GoodTooltip
      title={tooltip}
      isError={isInputError}
      isWarning={isUnconverted || isNoOutput}
      sx={{ p: 1, whiteSpace: 'break-spaces' }}
    >
      {isInputLoading
        ? <LoadingIndicator label={aLabel} />
        : (
          <Button
            size='sm'
            variant={variant} color={color}
            onClick={handleMenuToggle}
            sx={{
              backgroundColor: menuAnchor ? `${color}.softActiveBg` : variant === 'outlined' ? 'background.popup' : undefined,
              border: variant === 'soft' ? '1px solid' : undefined,
              borderColor: variant === 'soft' ? `${color}.solidBg` : undefined,
              borderRadius: 'sm',
              fontWeight: 'normal',
              ...ATTACHMENT_MIN_STYLE,
              px: 1, py: 0.5,
              display: 'flex', flexDirection: 'row', gap: 1,
            }}
          >
            {isInputError
              ? <InputErrorIndicator />
              : <>
                {attachmentIcon(attachment)}
                <Typography level='title-sm' sx={{ whiteSpace: 'nowrap' }}>
                  {attachmentText(attachment)}
                </Typography>
              </>}
          </Button>
        )}
    </GoodTooltip>

    {/* individual operations menu */}
    {!!menuAnchor && (
      <CloseableMenu
        placement='top' sx={{ minWidth: 200 }}
        open anchorEl={menuAnchor} onClose={handleMenuHide}
        noTopPadding noBottomPadding
      >

        {/* Move Arrows */}
        {!isUnmoveable && <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <MenuItem
            disabled={props.isPositionFirst}
            onClick={handleMoveUp}
            sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}
          >
            <KeyboardArrowLeftIcon />
          </MenuItem>
          <MenuItem
            disabled={props.isPositionLast}
            onClick={handleMoveDown}
            sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}
          >
            <KeyboardArrowRightIcon />
          </MenuItem>
        </Box>}
        {!isUnmoveable && <ListDivider sx={{ mt: 0 }} />}

        {/* Render Conversions as menu items */}
        {/*{!isUnconverted && <ListItem>*/}
        {/*  <Typography level='body-md'>*/}
        {/*    Attach as:*/}
        {/*  </Typography>*/}
        {/*</ListItem>}*/}
        {!isUnconverted && aConversions.map((conversion, idx) =>
          <MenuItem
            disabled={conversion.disabled}
            key={'c-' + conversion.id}
            onClick={async () => idx !== aConversionIdx && await handleSetConversionIdx(idx)}
          >
            <ListItemDecorator>
              <Radio checked={idx === aConversionIdx} />
            </ListItemDecorator>
            {conversion.name}
          </MenuItem>,
        )}
        {!isUnconverted && <ListDivider />}

        {DEBUG_ATTACHMENTS && (
          <MenuItem onClick={handleCopyOutputToClipboard}>
            <Box>
              {!!aInput && <Typography level='body-xs'>
                🡐 {aInput.mimeType}, {aInput.dataSize.toLocaleString()} bytes
              </Typography>}
              {/*<Typography level='body-xs'>*/}
              {/*  Conversions: {aConversions.map(((conversion, idx) => ` ${conversion.id}${(idx === aConversionIdx) ? '*' : ''}`)).join(', ')}*/}
              {/*</Typography>*/}
              <Typography level='body-xs'>
                🡒 {isNoOutput ? 'empty' : aOutputs?.map(output => `${output.type}, ${output.text.length.toLocaleString()} bytes`).join(' · ')}
              </Typography>
            </Box>
          </MenuItem>
        )}
        {DEBUG_ATTACHMENTS && <ListDivider />}

        {/* Destructive Operations */}
        <MenuItem onClick={handleInline}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Inline
        </MenuItem>
        <MenuItem onClick={handleRemove}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Remove
        </MenuItem>

      </CloseableMenu>
    )}

  </Box>;
}