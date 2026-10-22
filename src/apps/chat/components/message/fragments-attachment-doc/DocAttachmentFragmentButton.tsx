import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, Button, ColorPaletteProp, IconButton, Tooltip } from '@mui/joy';
import AbcIcon from '@mui/icons-material/Abc';
import CodeIcon from '@mui/icons-material/Code';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import TextureIcon from '@mui/icons-material/Texture';

import { ContentScaling, themeScalingMap } from '~/common/app.theme';
import { attachmentFragmentDocTitle, DMessageAttachmentFragment, DMessageFragmentId, DVMimeType, isDocPart } from '~/common/stores/chat/chat.fragments';
import { LiveFileIcon } from '~/common/livefile/liveFile.icons';
import { PhImageSquare } from '~/common/components/icons/phosphor/PhImageSquare';
import { PhVoice } from '~/common/components/icons/phosphor/PhVoice';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { ellipsizeMiddle } from '~/common/util/textUtils';
import { useLiveFileMetadata } from '~/common/livefile/useLiveFileMetadata';


// configuration
export const DocSelColor: ColorPaletteProp = 'primary';
const DocUnselColor: ColorPaletteProp = 'primary';


const _styles = {
  label: {
    whiteSpace: 'nowrap',
    fontWeight: 'md',
    minWidth: 48,
  },
} as const;


export function buttonIconForFragment(part: DMessageAttachmentFragment['part']): React.ComponentType<any> {
  const pt = part.pt;
  switch (pt) {

    // Reference Attachment Fragment
    case 'reference':
      const rt = part.rt;
      switch (rt) {
        case 'zync':
          const rZType = part.zType;
          switch (rZType) {
            case 'asset':
              const assetType = part.assetType;
              switch (assetType) {
                case 'image':
                  return PhImageSquare;
                case 'audio':
                  return PhVoice;
                default:
                  const _exhaustiveCheck: never = assetType;
                  return TextureIcon; // missing zync asset type
              }
            default:
              const _exhaustiveCheck: never = rZType;
              return TextureIcon; // missing zync entity type
          }

        case '_sentinel':
          return TextureIcon; // nothing to do here - this is a sentinel type

        default:
          const _exhaustiveCheck: never = rt;
          return TextureIcon; // case missing
      }

    // Document Attachment Fragment
    case 'doc':
      switch (part.vdt) {
        case DVMimeType.TextPlain:
          return TextFieldsIcon;
        case DVMimeType.VndAgiCode:
          return CodeIcon;
        case DVMimeType.VndAgiOcr:
          return part.meta?.srcOcrFrom === 'image' ? AbcIcon : PictureAsPdfIcon;
        // NOTE: the objective is to grow this set, but wisely
        // - no rush to fill the space, as we need data at rest & in flight (for auto type conversion) support,
        //   including the reintepretation of the deta in the Aix.Adapters
        // case INT_MIME_VND_AGI_EGO_FRAGMENTS:
        //   return TelegramIcon;
        // case INT_MIME_AGI_TEXT_HTML:
        //   return CodeIcon;
        // case 'text/markdown':
        //   return CodeIcon;
        default:
          const _exhaustiveCheck: never = part.vdt;
          return TextureIcon; // unknown doc type
      }

    // [OLD-style] Image Attachment Fragment
    case 'image_ref':
      return PhImageSquare;

    case '_pt_sentinel':
      return TextureIcon; // nothing to do here - this is a sentinel type

    default:
      const _exhaustiveCheck: never = pt;
      return TextureIcon; // case missing
  }
}


function DocAttachmentDeleteButton(props: { fragmentId: DMessageFragmentId, color: ColorPaletteProp, onFragmentDelete: (fragmentId: DMessageFragmentId) => void }) {

  const [deleteArmed, setDeleteArmed] = React.useState(false);

  // [effect] auto-disarm after timeout
  React.useEffect(() => {
    if (!deleteArmed) return;
    const timer = setTimeout(() => setDeleteArmed(false), 5000);
    return () => clearTimeout(timer);
  }, [deleteArmed]);

  const handleConfirm = (event: React.MouseEvent) => {
    event.stopPropagation();
    setDeleteArmed(false);
    props.onFragmentDelete(props.fragmentId);
  };

  const handleToggle = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!deleteArmed && event.shiftKey) return handleConfirm(event);
    setDeleteArmed(armed => !armed);
  };

  return (
    <Box
      onKeyDown={event => {
        if (event.key === 'Escape' && deleteArmed) {
          event.stopPropagation();
          setDeleteArmed(false);
        }
      }}
      sx={{ position: 'relative', display: 'flex', alignItems: 'center', px: 0.5, borderLeft: '1px solid', borderColor: `${props.color}.outlinedDisabledBorder`, '& svg': { fontSize: '1.25rem' } }}
    >
      {/* Overlay the confirm button to the left so arming never moves the cancel target or wraps the chip. */}
      {deleteArmed && (
        <Tooltip title='Confirm Deletion' color='danger' arrow disableInteractive>
          <IconButton size='sm' variant='outlined' color='danger' aria-label='Confirm Deletion' onClick={handleConfirm} sx={{ position: 'absolute', right: '100%', zIndex: 2, bgcolor: 'background.surface' }}>
            <DeleteForeverIcon sx={{ color: 'danger.solidBg' }} />
          </IconButton>
        </Tooltip>
      )}
      <Tooltip title={deleteArmed ? 'Cancel Deletion' : 'Delete Document'} color='warning' arrow disableInteractive>
        <IconButton size='sm' variant={deleteArmed ? 'solid' : 'plain'} color='warning' aria-label={deleteArmed ? 'Cancel Deletion' : 'Delete Document'} onClick={handleToggle} sx={{ my: -1 }}>
          {deleteArmed ? <CloseRoundedIcon /> : <DeleteOutlineIcon />}
        </IconButton>
      </Tooltip>
    </Box>
  );
}


export function DocAttachmentFragmentButton(props: {
  fragment: DMessageAttachmentFragment,
  contentScaling: ContentScaling,
  isSelected: boolean,
  isSelectable: boolean,
  color?: ColorPaletteProp, // the unselected look; selected is always DocSelColor
  dragHandle?: React.ReactNode,
  toggleSelected: (fragmentId: DMessageFragmentId) => void,
  onFragmentDelete?: (fragmentId: DMessageFragmentId) => void,
}) {

  // external state
  const liveFileMetadata = useLiveFileMetadata(props.fragment.liveFileId);

  // derived state
  const { fragment, isSelectable, isSelected, toggleSelected } = props;
  const unselColor = props.color ?? DocUnselColor;
  const hasLiveFile = !!liveFileMetadata;
  const isLiveFilePaired = liveFileMetadata ? liveFileMetadata.isPairingValid || false : false;

  // handlers
  const handleSelectFragment = React.useCallback(() => {
    toggleSelected(fragment.fId);
  }, [fragment.fId, toggleSelected]);

  // memos
  const buttonSx = React.useMemo((): SxProps => ({
    // from ATTACHMENT_MIN_STYLE
    // height: '100%',
    minHeight: props.contentScaling === 'md' ? 40 : props.contentScaling === 'sm' ? 38 : 36,
    minWidth: '64px',
    maxWidth: '340px',
    padding: 0,

    // style
    fontSize: themeScalingMap[props.contentScaling]?.fragmentButtonFontSize ?? undefined,
    border: '1px solid',
    borderRadius: 'sm',
    boxShadow: isSelected ? undefined : `0px 3px 4px -2px rgb(var(--joy-palette-${unselColor}-darkChannel) / 20%)`,
    ...isSelected ? {
      borderColor: `${DocSelColor}.solidBg`,
    } : {
      borderColor: `${unselColor}.outlinedBorder`,
      backgroundColor: 'background.popup',
    },

    // from LLMAttachmentButton
    display: 'flex', flexDirection: 'row',
  }), [isSelected, props.contentScaling, unselColor]);

  // only operate on doc fragments
  if (!isDocPart(fragment.part))
    return 'Unexpected: ' + fragment.part.pt;

  const Icon = isSelected ? EditRoundedIcon : buttonIconForFragment(fragment.part);

  const fullTitle = attachmentFragmentDocTitle(fragment);
  const buttonText = ellipsizeMiddle(fullTitle, 28 /* totally arbitrary length */);
  const showFilenameTooltip = fullTitle !== buttonText;

  const labelContent = <Box sx={_styles.label}>{buttonText}</Box>;

  return (
    <Button
      role={isSelectable ? 'button' : 'group'}
      component={(props.dragHandle || props.onFragmentDelete) ? 'div' : 'button' /* avoid nested buttons */}
      tabIndex={isSelectable ? undefined : -1}
      size={props.contentScaling === 'md' ? 'md' : 'sm'}
      variant={isSelected ? 'solid' : 'soft'}
      color={isSelected ? DocSelColor : unselColor}
      disabled={!(props.dragHandle || props.onFragmentDelete || isSelectable)}
      onClick={!isSelectable ? undefined : handleSelectFragment}
      sx={buttonSx}
    >
      {(!!props.dragHandle || !!Icon) && (
        <Box sx={{
          height: '80%', // was 100%, but it's neat-o to have the line a bit engraved
          ...(props.dragHandle ? { pl: 1.75 } : { px: 1 }),
          borderRight: '1px solid',
          borderRightColor: isSelected ? `${DocSelColor}.solidBg` : `${unselColor}.outlinedDisabledBorder`, // this was outlinedBorder
          display: 'flex', alignItems: 'center',
        }}>
          {props.dragHandle || <Icon />}
        </Box>
      )}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingX: '0.5rem' }}>
        {showFilenameTooltip
          ? <TooltipOutlined title={<span style={{ wordBreak: 'break-all' }}>{fullTitle}</span>}>{labelContent}</TooltipOutlined>
          : labelContent
        }
        {/*<Box sx={{ fontSize: 'xs', fontWeight: 'sm' }}>*/}
        {/*  {fragment.caption}*/}
        {/*</Box>*/}
      </Box>
      {hasLiveFile && isSelectable && (
        <TooltipOutlined
          title={!isLiveFilePaired ? 'LiveFile needs re-pairing.' : 'LiveFile is supported'}
          color={!isLiveFilePaired ? 'danger' : 'success'}
          placement='top-end'
        >
          <LiveFileIcon
            color={!isSelected ? 'success' : undefined}
            sx={{ mr: '0.5rem', color: (!isLiveFilePaired && !isSelected) ? 'darkred' : undefined }}
          />
        </TooltipOutlined>
      )}
      {!!props.onFragmentDelete && (
        <DocAttachmentDeleteButton fragmentId={fragment.fId} color={unselColor} onFragmentDelete={props.onFragmentDelete} />
      )}
    </Button>
  );
}
