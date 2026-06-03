import * as React from 'react';

import type { SxProps } from '@mui/joy/styles/types';
import { Box, CircularProgress, IconButton, ListDivider, ListItem, ListItemDecorator, MenuItem, Typography } from '@mui/joy';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ForkRightIcon from '@mui/icons-material/ForkRight';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import TelegramIcon from '@mui/icons-material/Telegram';
import TextureIcon from '@mui/icons-material/Texture';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';

import { ModelVendorAnthropic } from '~/modules/llms/vendors/anthropic/anthropic.vendor';

import type { DLLMId } from '~/common/stores/llms/llms.types';
import { AnthropicIcon } from '~/common/components/icons/vendors/AnthropicIcon';
import { ChatBeamIcon } from '~/common/components/icons/ChatBeamIcon';
import { CloseablePopup } from '~/common/components/CloseablePopup';
import { SubMenuHost, SubMenuItem, useSubMenuHost } from '~/common/components/SubMenu';
import { DMessageUserFlag, MESSAGE_FLAG_AIX_SKIP, MESSAGE_FLAG_NOTIFY_COMPLETE, MESSAGE_FLAG_STARRED, MESSAGE_FLAG_VND_ANT_CACHE_USER } from '~/common/stores/chat/chat.message';
import { KeyStroke } from '~/common/components/KeyStroke';
import { PhGearSixIcon } from '~/common/components/icons/phosphor/PhGearSixIcon';
import { PhTreeStructure } from '~/common/components/icons/phosphor/PhTreeStructure';
import { PhVoice } from '~/common/components/icons/phosphor/PhVoice';
import { StarredState } from '~/common/components/StarIcons';
import { TooltipOutlined } from '~/common/components/TooltipOutlined';
import { optimaOpenPreferences } from '~/common/layout/optima/useOptima';
import { useUIPreferencesStore } from '~/common/stores/store-ui';

import { setIsNotificationEnabledForModel } from '../../store-app-chat';


const antCachePromptOffSx: SxProps = {
  transition: 'color 0.16s, transform 0.16s',
};

const antCachePromptOnSx: SxProps = {
  ...antCachePromptOffSx,
  color: ModelVendorAnthropic.brandColor,
  transform: 'rotate(90deg)',
};


export function ChatMessageMenu(props: {
  anchor: HTMLElement,
  onClose: () => void

  isMobile: boolean,
  isBottom: boolean,
  fromAssistant: boolean,
  fromSystem: boolean,
  // canTextChart: boolean,
  canTextDiagram: boolean,
  canTextImagine: boolean,
  canTextSpeak: boolean,
  isEditingText: boolean,
  isPendingIncomplete: boolean,
  isTextImagining: boolean,
  isUserMessageSkipped: boolean,
  isUserNotifyComplete: boolean,
  userNotifyCompleteLlmId: DLLMId | null,
  isUserStarred: boolean,
  isVndAndCacheAuto: boolean,
  isVndAndCacheUser: boolean,
  showVndAntCaching: boolean,

  // actions
  onMessageDelete?: (event: React.MouseEvent) => void,
  onMessageUserFlagToggle?: (flag: DMessageUserFlag, maxPerConversation?: number) => void,
  onOpsAssistantFrom?: (event: React.MouseEvent) => void,
  onOpsBeamFrom?: (event: React.MouseEvent) => void,
  onOpsBranchFrom?: (event: React.MouseEvent) => void,
  onOpsMessageCopySrc?: (event: React.MouseEvent) => void,
  onOpsMessageEditToggle?: (event: React.MouseEvent) => void,
  onOpsMessageTruncate?: (event: React.MouseEvent) => void,
  onOpsShowInfo?: () => void,
  // onOpsTextChart?: (event: React.MouseEvent) => void,
  onOpsTextDiagram?: (event: React.MouseEvent) => void,
  onOpsTextImagine?: (event: React.MouseEvent) => void,
  onOpsTextSpeak?: (event: React.MouseEvent) => void,
  onPersonaVoiceSettings?: () => void,
}) {

  // external state
  const doubleClickToEdit = useUIPreferencesStore(state => state.doubleClickToEdit);
  const subMenuHost = useSubMenuHost();

  // state
  // const [showDiff, setShowDiff] = useChatShowTextDiff();
  // const handleOpsToggleShowDiff = () => setShowDiff(!showDiff);

  // destructure
  const {
    fromAssistant,
    fromSystem,
    isPendingIncomplete: pending,
    onClose,
    onMessageDelete,
    onMessageUserFlagToggle,
    onOpsAssistantFrom,
    onOpsBeamFrom,
    onOpsBranchFrom,
    onOpsMessageCopySrc,
    onOpsMessageEditToggle,
    onOpsMessageTruncate,
    onOpsShowInfo,
    onOpsTextDiagram,
    onOpsTextImagine,
    onOpsTextSpeak,
    onPersonaVoiceSettings,
  } = props;


  // handlers

  const handleShowInfo = React.useCallback(() => {
    onClose();
    onOpsShowInfo?.();
  }, [onClose, onOpsShowInfo]);

  const handleOpsToggleNotifyComplete = React.useCallback(() => {
    if (!onMessageUserFlagToggle || !props.userNotifyCompleteLlmId) return;
    setIsNotificationEnabledForModel(props.userNotifyCompleteLlmId, !props.isUserNotifyComplete);
    onMessageUserFlagToggle(MESSAGE_FLAG_NOTIFY_COMPLETE);
  }, [onMessageUserFlagToggle, props.isUserNotifyComplete, props.userNotifyCompleteLlmId]);

  const handleSpeakAndClose = React.useCallback((e: React.MouseEvent) => {
    onOpsTextSpeak?.(e);
    onClose();
  }, [onClose, onOpsTextSpeak]);

  const handleSpeakSettings = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
    if (onPersonaVoiceSettings)
      onPersonaVoiceSettings();
    else
      optimaOpenPreferences('voice');
  }, [onClose, onPersonaVoiceSettings]);

  return (
    <SubMenuHost host={subMenuHost}>
    <CloseablePopup
      menu anchorEl={props.anchor} onClose={props.onClose}
      dense
      minWidth={260}
      // zIndex={1501}
      placement={fromAssistant ? 'auto-start' : 'auto-end'}
    >

      {fromSystem && (
        <ListItem>
          <Typography level='body-sm'>
            System message
          </Typography>
        </ListItem>
      )}

      {/* Edit + Copy + Starred */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        {/* Edit */}
        {onOpsMessageEditToggle && (
          <TooltipOutlined title={props.isMobile || props.isEditingText ? undefined : !doubleClickToEdit ? 'You can also Shift + Double-Click any chat response' : undefined}>
            <MenuItem disabled={pending} onClick={onOpsMessageEditToggle} sx={{ flex: 1 }}>
              <ListItemDecorator>{props.isEditingText ? <CloseRoundedIcon /> : <EditRoundedIcon />}</ListItemDecorator>
              {props.isEditingText ? 'Discard' : 'Edit'}
            </MenuItem>
          </TooltipOutlined>
        )}
        {/* Copy */}
        <MenuItem onClick={onOpsMessageCopySrc} sx={{ flex: 1 }}>
          <ListItemDecorator><ContentCopyIcon /></ListItemDecorator>
          Copy
        </MenuItem>
        {/* Starred */}
        {onMessageUserFlagToggle && (
          <MenuItem onClick={() => onMessageUserFlagToggle(MESSAGE_FLAG_STARRED)} sx={{ flexGrow: 0, px: 1 }}>
            <TooltipOutlined title={!props.isUserStarred ? 'Star message - use @ to refer to it from another chat' : 'Remove star'}>
              <span style={{ display: 'flex' }}><StarredState isStarred={props.isUserStarred} /></span>
            </TooltipOutlined>
          </MenuItem>
        )}
        {/* Info */}
        {!!onOpsShowInfo && (
          <MenuItem onClick={handleShowInfo} sx={{ flexGrow: 0, px: 1 }}>
            <InfoOutlinedIcon sx={{ fontSize: 'xl' }} />
          </MenuItem>
        )}
      </Box>

      {/* Notify Complete */}
      {pending && onMessageUserFlagToggle && <ListDivider />}
      {pending && onMessageUserFlagToggle && (
        <MenuItem disabled={!props.userNotifyCompleteLlmId} onClick={handleOpsToggleNotifyComplete}>
          <ListItemDecorator>{props.isUserNotifyComplete ? <NotificationsActiveIcon color='success' /> : <NotificationsOutlinedIcon />}</ListItemDecorator>
          Notify on reply
        </MenuItem>
      )}


      {/* Delete / Branch / Truncate */}
      {onOpsBranchFrom && <ListDivider />}
      {onOpsBranchFrom && (
        <MenuItem onClick={onOpsBranchFrom} disabled={fromSystem}>
          <ListItemDecorator><ForkRightIcon /></ListItemDecorator>
          Branch {!props.isBottom && <span style={{ opacity: 0.5 }}>from here</span>}
        </MenuItem>
      )}
      {onMessageDelete && (
        <MenuItem onClick={onMessageDelete}>
          <ListItemDecorator><DeleteOutlineIcon /></ListItemDecorator>
          Delete <span style={{ opacity: 0.5 }}>message</span>
        </MenuItem>
      )}
      {onOpsMessageTruncate && (
        <MenuItem onClick={onOpsMessageTruncate} disabled={props.isBottom}>
          <ListItemDecorator><VerticalAlignBottomIcon /></ListItemDecorator>
          Truncate <span style={{ opacity: 0.5 }}>after this</span>
        </MenuItem>
      )}

      {/* Aix Skip Message */}
      {!pending && <ListDivider />}
      {!pending && onMessageUserFlagToggle && (
        <MenuItem onClick={() => onMessageUserFlagToggle(MESSAGE_FLAG_AIX_SKIP)}>
          <ListItemDecorator>{props.isUserMessageSkipped ? <VisibilityOffIcon sx={{ color: 'danger.plainColor' }} /> : <VisibilityOffIcon sx={{ color: 'neutral.plainDisabledColor' }} /> /*<VisibilityIcon />*/}</ListItemDecorator>
          {props.isUserMessageSkipped ? 'Unskip' : 'Skip message'}
        </MenuItem>
      )}
      {/* Anthropic Breakpoint Toggle */}
      {!pending && props.showVndAntCaching && (
        <MenuItem onClick={() => onMessageUserFlagToggle?.(MESSAGE_FLAG_VND_ANT_CACHE_USER, 2)}>
          <ListItemDecorator><AnthropicIcon sx={props.isVndAndCacheUser ? antCachePromptOnSx : antCachePromptOffSx} /></ListItemDecorator>
          {props.isVndAndCacheUser ? 'Do not cache' : <>Cache <span style={{ opacity: 0.5 }}>up to here</span></>}
        </MenuItem>
      )}
      {!pending && props.showVndAntCaching && props.isVndAndCacheAuto && !props.isVndAndCacheUser && (
        <MenuItem disabled>
          <ListItemDecorator><TextureIcon sx={{ color: ModelVendorAnthropic.brandColor }} /></ListItemDecorator>
          Auto-Cached <span style={{ opacity: 0.5 }}>for 5 min</span>
        </MenuItem>
      )}

      {/* Diagram / Draw / Speak */}
      {onOpsTextDiagram && <ListDivider />}
      {(onOpsTextDiagram || onOpsTextImagine) && (
        <SubMenuItem
          label='AI generate'
          decorator={<AddCircleOutlineIcon color={(pending || fromSystem) ? undefined : 'success'} />}
          disabled={pending}
          isMobile={props.isMobile}
          minWidth={260}
        >
          <ListItem>
            <Typography level='body-sm'>Add Message</Typography>
          </ListItem>
          {onOpsTextDiagram && (
            <MenuItem onClick={onOpsTextDiagram} disabled={!props.canTextDiagram}>
              <ListItemDecorator><PhTreeStructure color='success' /></ListItemDecorator>
              Create Diagram ...
            </MenuItem>
          )}
          {onOpsTextImagine && (
            <MenuItem onClick={onOpsTextImagine} disabled={!props.canTextImagine || props.isTextImagining}>
              <ListItemDecorator>{props.isTextImagining ? <CircularProgress color='success' size='sm' sx={{ '--CircularProgress-size': '1.25rem' }} /> : <FormatPaintOutlinedIcon color='success' />}</ListItemDecorator>
              Create Picture
            </MenuItem>
          )}
        </SubMenuItem>
      )}
      {onOpsTextSpeak && (
        <MenuItem disabled={pending} onClick={handleSpeakAndClose}>
          <ListItemDecorator>
            {/*{props.isTextSpeaking ? <CircularProgress color='success' size='sm' sx={{ '--CircularProgress-size': '1.25rem' }} /> : <PhVoice color={pending ? undefined : 'success'} />}*/}
            <PhVoice color={pending ? undefined : 'success'} />
          </ListItemDecorator>
          Speak
          {/*<GoodTooltip arrow title={props.isMobile ? null : props.onPersonaVoiceSettings ? 'Persona Voice' : 'App Voice Settings'} placement='top'>*/}
          <IconButton
            size='sm'
            variant='soft'
            disabled={pending}
            onClick={handleSpeakSettings}
            sx={{ ml: 'auto', mr: -1, my: '-0.25rem', backgroundColor: 'transparent' }}
          >
            <PhGearSixIcon sx={{ fontSize: 'lg' }} />
          </IconButton>
          {/*</GoodTooltip>*/}
        </MenuItem>
      )}


      {/* Diff Viewer */}
      {/*{!!diffPreviousText && <ListDivider />}*/}
      {/*{!!diffPreviousText && (*/}
      {/*  <MenuItem onClick={handleOpsToggleShowDiff}>*/}
      {/*    <ListItemDecorator><DifferenceIcon /></ListItemDecorator>*/}
      {/*    Show difference*/}
      {/*    <Switch checked={showDiff} onChange={handleOpsToggleShowDiff} sx={{ ml: 'auto' }} />*/}
      {/*  </MenuItem>*/}
      {/*)}*/}

      {/* Retry/Beam Edit */}
      {(onOpsAssistantFrom || onOpsBeamFrom) && <ListDivider />}
      {onOpsAssistantFrom && (
        <MenuItem disabled={fromSystem} onClick={onOpsAssistantFrom}>
          <ListItemDecorator>{fromAssistant ? <ReplayIcon color='primary' /> : <TelegramIcon color='primary' />}</ListItemDecorator>
          {!fromAssistant
            ? <>Restart <span style={{ opacity: 0.5 }}>from here</span></>
            : !props.isBottom
              ? <>Retry <span style={{ opacity: 0.5 }}>from here</span></>
              : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Retry<KeyStroke variant='outlined' size='sm' combo='Ctrl + Shift + Z' /></Box>}
        </MenuItem>
      )}
      {onOpsBeamFrom && (
        <MenuItem disabled={fromSystem} onClick={onOpsBeamFrom}>
          <ListItemDecorator>
            <ChatBeamIcon color={fromSystem ? undefined : 'primary'} />
          </ListItemDecorator>
          {!fromAssistant
            ? <>Beam <span style={{ opacity: 0.5 }}>from here</span></>
            : !props.isBottom
              ? <>Beam Edit</>
              : <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>Beam Edit<KeyStroke variant='outlined' size='sm' combo='Ctrl + Shift + B' /></Box>}
        </MenuItem>
      )}

    </CloseablePopup>
    </SubMenuHost>
  );
}
