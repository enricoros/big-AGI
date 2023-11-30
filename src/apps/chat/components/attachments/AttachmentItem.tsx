import * as React from 'react';

import { Box, Button, CircularProgress, ColorPaletteProp, Divider, ListItemDecorator, MenuItem, Sheet, Typography } from '@mui/joy';
import ClearIcon from '@mui/icons-material/Clear';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';

import { CloseableMenu } from '~/common/components/CloseableMenu';
import { GoodTooltip } from '~/common/components/GoodTooltip';
import { ellipsizeMiddle } from '~/common/util/textUtils';

import type { Attachment } from './attachment.types';


// default attachment width
const ATTACHMENT_MIN_WIDTH = 64;


const ellipsizeLabel = (label: string) =>
  ellipsizeMiddle(label.replace(/https?:\/\/(?:www\.)?/, ''), 30)
    .replace('…', '…\n…');


/**
 * Displayed while a source is loading
 */
const LoadingIndicator = React.forwardRef((props: { label: string }, ref) =>
  <Sheet
    color='success' variant='soft'
    sx={{
      border: '1px solid',
      borderColor: 'success.solidBg',
      borderRadius: 'xs',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1,
      height: '100%',
      minWidth: ATTACHMENT_MIN_WIDTH,
      px: 1,
      py: 0.5,
    }}
  >
    <CircularProgress color='success' size='sm' />
    <Typography level='body-xs' sx={{ whiteSpace: 'break-spaces' }}>
      {ellipsizeLabel(props.label)}
    </Typography>
  </Sheet>,
);
LoadingIndicator.displayName = 'LoadingIndicator';

const SourceErrorIndicator = () =>
  <WarningRoundedIcon
    sx={{
      color: 'danger.solidBg',
      minWidth: ATTACHMENT_MIN_WIDTH,
    }}
  />;


export function AttachmentItem(props: {
  attachment: Attachment,
  onAttachmentRemove: (attachmentId: string) => void
}) {

  // state
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLAnchorElement | null>(null);

  // derived state
  const { attachment, onAttachmentRemove } = props;
  const {
    id: aId,
    label: aLabel,
    input: aInput,
    availableConversions: aConversions,
    outputs: aOutputs,
  } = attachment;

  console.log('AttachmentItem', attachment);

  const isSourceLoading = attachment.sourceLoading;
  const isSourceError = !!attachment.sourceError;
  const isMissingConversions = aConversions?.length === 0;

  const hasInput = !!aInput;
  const hasOutputs = aOutputs ? aOutputs.length >= 1 : false;

  const areOutputsEjectable = hasOutputs && aOutputs?.every(output => output.isEjectable);

  // menu

  const handleMenuHide = () => setMenuAnchor(null);

  const handleMenuToggle = (event: React.MouseEvent<HTMLAnchorElement>) =>
    setMenuAnchor(anchor => anchor ? null : event.currentTarget);


  // operations

  const handleRemoveAttachment = React.useCallback(() => {
    handleMenuHide();
    onAttachmentRemove(aId);
  }, [onAttachmentRemove, aId]);

  let tooltip: string;
  let variant: 'soft' | 'outlined' | 'contained';
  let color: ColorPaletteProp;

  // compose tooltip
  tooltip = `${props.attachment.source.type !== 'text' ? props.attachment.source.type + ': ' : ''}${aLabel}`;
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
  } else if (isMissingConversions) {
    tooltip = `Attachments of type '${aInput?.mimeType}' are not supported yet. You can open a feature request on GitHub.\n\n${tooltip}`;
    variant = 'soft';
    color = 'warning';
  } else {
    tooltip = attachment.source.type;
    variant = 'soft';
    color = 'neutral';
  }


  return <Box>

    <GoodTooltip title={tooltip} isError={isSourceError} isWarning={isMissingConversions} sx={{ p: 1, whiteSpace: 'break-spaces' }}>
      {isSourceLoading
        ? <LoadingIndicator label={aLabel} />
        : <Button
          variant={variant} color={color} size='sm'
          onClick={handleMenuToggle}
          sx={{
            borderRadius: 'xs',
            flexDirection: 'column',
            fontWeight: 'normal',
            height: '100%',
            px: 1, py: 0.5,
          }}
        >
          {isSourceError
            ? <SourceErrorIndicator />
            : <Typography level='title-sm' sx={{ whiteSpace: 'break-spaces' }}>{ellipsizeLabel(aLabel)}</Typography>
          }

          {hasInput && <Typography level='body-xs'>
            {aInput.mimeType} - {aInput.dataSize.toLocaleString()}
          </Typography>}

          {hasOutputs && <Typography level='body-sm'>
            {JSON.stringify(aOutputs)}
          </Typography>}

        </Button>}
    </GoodTooltip>

    {/* Item Menu */}
    {!!menuAnchor && (
      <CloseableMenu
        placement='top' sx={{ minWidth: 200 }}
        open anchorEl={menuAnchor} onClose={handleMenuHide}
      >
        <MenuItem disabled>
          Type ...
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleRemoveAttachment}>
          <ListItemDecorator><ClearIcon /></ListItemDecorator>
          Remove
        </MenuItem>
      </CloseableMenu>
    )}

  </Box>;
}