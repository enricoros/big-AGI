import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, ListDivider, ListItem, ListItemDecorator, MenuItem, Sheet, Typography } from '@mui/joy';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import CodeIcon from '@mui/icons-material/Code';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import PivotTableChartIcon from '@mui/icons-material/PivotTableChart';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ellipsizeFront, ellipsizeMiddle } from '~/common/util/textUtils';

import { Attachment, AttachmentConversion, useAttachmentsStore } from './store-attachments';


// default attachment width
const ATTACHMENT_MIN_STYLE = {
  height: '100%',
  minHeight: '36px',
  minWidth: '64px',
};


const ellipsizeLabel = (label: string) =>
  ellipsizeMiddle(label.replace(/https?:\/\/(?:www\.)?/, ''), 30)
    .replace('…', '…\n…');


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


const SourceErrorIndicator = () =>
  <WarningRoundedIcon sx={{ color: 'danger.solidBg' }} />;


function attachmentIcon(conversion: AttachmentConversion | null) {
  const iconSx = {
    width: 24,
    height: 24,
  };
  switch (conversion?.id) {
    case 'text':
      return <TextFieldsIcon sx={iconSx} />;
    case 'rich-text':
      return <CodeIcon sx={iconSx} />;
    case 'rich-text-table':
      return <PivotTableChartIcon sx={iconSx} />;
    // case 'image':
    //   return <img src={conversion.url} alt={conversion.name} style={{ maxHeight: '100%', maxWidth: '100%' }} />;
    default:
      return null;
  }
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


  const isSourceLoading = attachment.sourceLoading;
  const isSourceError = !!attachment.sourceError;
  const isUnsupported = aConversions.length === 0;

  const conversion = (aConversionIdx !== null ? aConversions[aConversionIdx] : null) || null;

  const hasInput = !!aInput;
  const hasOutputs = aOutputs ? aOutputs.length >= 1 : false;

  const areOutputsEjectable = hasOutputs && aOutputs?.every(output => output.isEjectable);


  let variant: 'soft' | 'outlined' | 'contained';
  let color: ColorPaletteProp;

  // compose tooltip
  let tooltip: string | null = '';
  if (props.attachment.source.type !== 'text')
    tooltip += props.attachment.source.type + ': ';
  tooltip += aLabel;
  if (hasInput)
    tooltip += `\n(${aInput.mimeType}: ${aInput.dataSize.toLocaleString()} bytes)`;
  if (hasOutputs)
    tooltip += `\n\n${JSON.stringify(aOutputs)}`;

  if (isSourceLoading) {
    variant = 'soft';
    color = 'success';
  } else if (isSourceError) {
    tooltip = `Issue loading the attachment: ${attachment.sourceError}\n\n${tooltip}`;
    variant = 'soft';
    color = 'danger';
  } else if (isUnsupported) {
    tooltip = `Attachments of type '${aInput?.mimeType}' are not supported yet. You can open a feature request on GitHub.\n\n${tooltip}`;
    variant = 'soft';
    color = 'warning';
  } else {
    // all good
    tooltip = null;
    variant = 'outlined';
    color = 'primary';
  }


  return <Box>

    <GoodTooltip title={tooltip} isError={isSourceError} isWarning={isUnsupported} sx={{ p: 1, whiteSpace: 'break-spaces' }}>
      {isSourceLoading
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
            {isSourceError
              ? <SourceErrorIndicator />
              : <>
                {attachmentIcon(conversion)}
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
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
        </Box>

        <ListDivider />

        {/* Render Conversions as menu items */}
        <ListItem>
          <Typography level='body-md'>
            Attach as:
          </Typography>
        </ListItem>
        {aConversions.map((conversion, idx) =>
          <MenuItem key={'c-' + conversion.id} disabled={idx > 0 || true}>
            <ListItemDecorator>{idx === aConversionIdx ? <CheckIcon /> : undefined}</ListItemDecorator>
            {conversion.name}
          </MenuItem>,
        )}

        <ListDivider />

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