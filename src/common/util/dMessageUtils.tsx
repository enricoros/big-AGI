import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box } from '@mui/joy';
import Face6Icon from '@mui/icons-material/Face6';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { MetricsChatGenerateCost_Md } from '~/common/stores/metrics/metrics.chatgenerate';
import type { DMessage, DMessageGenerator, DMessageRole } from '~/common/stores/chat/chat.message';
import type { UIComplexityMode } from '~/common/app.theme';
import { animationColorRainbow } from '~/common/util/animUtils';
import { formatModelsCost } from '~/common/util/costUtils';


// configuration
export const ANIM_BUSY_TYPING = 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp';
const ANIM_BUSY_DOWNLOADING = 'https://i.giphy.com/26u6dIwIphLj8h10A.webp'; // hourglass: https://i.giphy.com/TFSxpAIYz5inJGuY8f.webp, small-lq: https://i.giphy.com/131tNuGktpXGhy.webp, floppy: https://i.giphy.com/RxR1KghIie2iI.webp
const ANIM_BUSY_PAINTING = 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp';
const ANIM_BUSY_THINKING = 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp';


export const avatarIconSx = {
  borderRadius: 'sm',
  height: 36,
  width: 36,
} as const;

const largerAvatarIconsSx = {
  borderRadius: 'sm',
  width: 48,
  height: 48,
};

const aixSkipBoxSx = {
  height: 36,
  width: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const aixSkipIconSx = {
  color: 'neutral.solidBg',
};

const tooltipSx: SxProps = {
  fontSize: 'sm',
  p: 1,
  display: 'grid',
  gap: 1,
};

const tooltipIconContainerSx: SxProps = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const tooltipCreationTimeSx: SxProps = {
  fontSize: 'xs',
  color: 'text.tertiary',
};

const tooltipMetricsGridSx: SxProps = {
  // grid of 2 columns, the first fits the labels, the other expends with the values
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 0.5,
};


/** Whole message background color, based on the message role and state */
export function messageBackground(messageRole: DMessageRole | string, wasEdited: boolean, isAssistantIssue: boolean): string {
  switch (messageRole) {
    case 'user':
      return 'primary.plainHoverBg'; // was .background.level1
    case 'assistant':
      return isAssistantIssue ? 'danger.softBg' : 'background.surface';
    case 'system':
      return wasEdited ? 'warning.softHoverBg' : 'neutral.softBg';
    default:
      return '#ff0000';
  }
}


/** Message avatar icon, based on the message role and state (e.g. notification pending, is generating, etc.) */
export function makeMessageAvatarIcon(
  uiComplexityMode: UIComplexityMode,
  messageRole: DMessageRole | string,
  messageGeneratorName: string | undefined,
  messagePurposeId: SystemPurposeId | string | undefined,
  messageIncomplete: boolean,
  messageFlagAixSkip: boolean,
  messageFlaxNotifyComplete: boolean,
  larger: boolean,
): React.JSX.Element {

  const nameOfRole =
    messageRole === 'user' ? 'You'
      : messageRole === 'assistant' ? 'Assistant'
        : 'System';

  // if skipped, just return the skip symbol
  if (messageFlagAixSkip)
    return <Box sx={aixSkipBoxSx}><VisibilityOffOutlinedIcon sx={aixSkipIconSx} /></Box>;

  // if pending a notification, return the busy icon
  if (messageFlaxNotifyComplete)
    return <Box sx={aixSkipBoxSx}><NotificationsActiveIcon sx={aixSkipIconSx} /></Box>;

  switch (messageRole) {
    case 'system':
      return <SettingsSuggestIcon sx={avatarIconSx} />;  // https://em-content.zobj.net/thumbs/120/apple/325/robot_1f916.png

    case 'user':
      return <Face6Icon sx={avatarIconSx} />;            // https://www.svgrepo.com/show/306500/openai.svg

    case 'assistant':
      const isDownload = messageGeneratorName === 'web';
      const isTextToImage = messageGeneratorName === 'DALL·E' || messageGeneratorName === 'Prodia';
      const isReact = messageGeneratorName?.startsWith('react-');

      // Extra appearance
      if (uiComplexityMode === 'extra') {

        // Pending animations (larger too)
        if (messageIncomplete)
          return <Avatar
            variant='plain'
            alt={nameOfRole}
            src={isDownload ? ANIM_BUSY_DOWNLOADING
              : isTextToImage ? ANIM_BUSY_PAINTING
                : isReact ? ANIM_BUSY_THINKING
                  : ANIM_BUSY_TYPING}
            sx={larger ? largerAvatarIconsSx : avatarIconSx}
          />;

        // Purpose image (if present)
        const purposeImage = SystemPurposes[messagePurposeId as SystemPurposeId]?.imageUri ?? undefined;
        if (purposeImage)
          return <Avatar
            variant='plain'
            alt={nameOfRole}
            src={purposeImage}
            sx={avatarIconSx}
          />;

      }

      // mode: text-to-image
      if (isTextToImage)
        return <FormatPaintOutlinedIcon sx={!messageIncomplete ? avatarIconSx : {
          ...avatarIconSx,
          animation: `${animationColorRainbow} 1s linear infinite`,
        }} />;

      // TODO: llm symbol (if messageIncomplete)
      // if (messageIncomplete)

      // purpose symbol (if present)
      const symbol = SystemPurposes[messagePurposeId as SystemPurposeId]?.symbol;
      if (symbol)
        return <Box sx={{
          fontSize: '24px',
          textAlign: 'center',
          width: '100%',
          minWidth: `${avatarIconSx.width}px`,
          lineHeight: `${avatarIconSx.height}px`,
        }}>
          {symbol}
        </Box>;

      // default assistant avatar
      return <SmartToyOutlinedIcon sx={avatarIconSx} />; // https://mui.com/static/images/avatar/2.jpg
  }
  return <Avatar alt={nameOfRole} />;
}


/** Message avatar label and tooltip, based on the message generator and state */
export function useMessageAvatarLabel(
  messageParts: Pick<DMessage, 'generator' | 'pendingIncomplete' | 'created' | 'updated'> | undefined,
  complexity: UIComplexityMode,
): { label: React.ReactNode; tooltip: React.ReactNode } {
  // we do this for performance reasons, to only limit re-renders to these parts of the message
  const { generator, pendingIncomplete, created, updated } = messageParts || {};
  return React.useMemo(() => {
    if (created === undefined) {
      return {
        label: 'unk-msg',
        tooltip: null,
      };
    }
    if (!generator) {
      return {
        label: 'unk-model',
        tooltip: null,
      };
    }

    // incomplete: just the name
    const prettyName = prettyShortChatModelName(generator.name);
    if (pendingIncomplete)
      return {
        label: prettyName,
        tooltip: (!created || complexity === 'minimal') ? null : (
          <Box sx={tooltipSx}>
            <TimeAgo date={created} formatter={(value: number, unit: string, _suffix: string) => `Thinking for ${value} ${unit}${value > 1 ? 's' : ''}...`} />
          </Box>
        ),
      };

    // named generator: nothing else to do there
    if (generator.mgt === 'named')
      return {
        label: prettyName,
        tooltip: prettyName !== generator.name ? generator.name : null,
      };

    // aix generator: details galore
    const modelId = generator.aix?.mId ?? null;
    const vendorId = generator.aix?.vId ?? null;
    const VendorIcon = (vendorId && complexity !== 'minimal') ? findModelVendor(vendorId)?.Icon : null;
    const metrics = generator.metrics ? _prettyMetrics(generator.metrics) : null;
    const stopReason = generator.tokenStopReason ? _prettyTokenStopReason(generator.tokenStopReason, complexity) : null;

    // aix tooltip: more details
    return {
      label: (stopReason && complexity !== 'minimal') ? <>{prettyName} <small>({stopReason})</small></> : prettyName,
      tooltip: complexity === 'minimal' ? null : (
        <Box sx={tooltipSx}>
          {VendorIcon ? <Box sx={tooltipIconContainerSx}><VendorIcon />{generator.name}</Box> : <div>{generator.name}</div>}
          {(modelId && complexity === 'extra') && <div>{modelId}</div>}
          {metrics && <div>{metrics}</div>}
          {stopReason && <div>{stopReason}</div>}
          {complexity === 'extra' && !!created && <Box sx={tooltipCreationTimeSx}>{updated ? 'Updated' : 'Created'} <TimeAgo date={updated || created} />.</Box>}
        </Box>
      ),
    };
  }, [complexity, created, generator, pendingIncomplete, updated]);
}

function _prettyMetrics(metrics: DMessageGenerator['metrics']): React.ReactNode {
  if (!metrics) return null;
  const costCode = metrics.$code ? _prettyCostCode(metrics.$code) : null;
  return <Box sx={tooltipMetricsGridSx}>
    {metrics?.TIn !== undefined && <div>Tokens:</div>}
    {metrics?.TIn !== undefined && <div>
      {' '}<b>{metrics.TIn?.toLocaleString() || ''}</b> in
      {metrics.TCacheRead !== undefined && <>{' · '}<b>{metrics.TCacheRead?.toLocaleString() || ''}</b> read</>}
      {metrics.TCacheWrite !== undefined && <>{' · '}<b>{metrics.TCacheWrite?.toLocaleString() || ''}</b> wrote</>}
      {', '}<b>{metrics.TOut?.toLocaleString() || ''}</b> out
      {metrics.TOutR !== undefined && <> (<b>{metrics.TOutR?.toLocaleString() || ''}</b> for reasoning)</>}
      {/*{metrics.TOutA !== undefined && <> (<b>{metrics.TOutA?.toLocaleString() || ''}</b> for audio)</>}*/}
    </div>}
    {metrics?.$c !== undefined && <div>Costs:</div>}
    {metrics?.$c !== undefined && <div>
      <b>{formatModelsCost(metrics.$c / 100)}</b>
      {metrics.$cdCache !== undefined && <>
        {' '}<small>(
        {metrics.$cdCache > 0
          ? <>cache savings: <b>{formatModelsCost(metrics.$cdCache / 100)}</b></>
          : <>cache costs: <b>{formatModelsCost(-metrics.$cdCache / 100)}</b></>
        })</small>
      </>}
    </div>}
    {costCode && <div />}
    {costCode && <div><em>{costCode}</em></div>}
  </Box>;
}

function _prettyCostCode(code: MetricsChatGenerateCost_Md['$code']): string | null {
  if (!code) return null;
  switch (code) {
    case 'free':
      return 'Free';
    case 'no-tokens':
      return 'Missing tokens for pricing';
    case 'no-pricing':
      return 'Model pricing not available';
    case 'partial-msg':
      return 'Incomplete Message - Partial Cost';
    case 'partial-price':
      return 'Model pricing is incomplete';
  }
}

function _prettyTokenStopReason(reason: DMessageGenerator['tokenStopReason'], complexity: UIComplexityMode): string | null {
  if (!reason) return null;
  switch (reason) {
    case 'client-abort':
      return complexity !== 'minimal' ? 'Stopped' : '';
    case 'filter':
      return 'Filtered';
    case 'issue':
      return complexity === 'extra' ? 'Error' : '';
    case 'out-of-tokens':
      return 'Out of Tokens';
  }
}


/** Pretty name for a chat model ID - VERY HARDCODED - shall use the Avatar Label-style code instead */
export function prettyShortChatModelName(model: string | undefined): string {
  if (!model) return '';

  // TODO: fully reform this function to be using information from the DLLM, rather than this manual mapping

  // [OpenAI]
  if (model.endsWith('-o1')) return 'o1';
  if (model.includes('o1-')) {
    if (model.includes('o1-mini')) return 'o1 Mini';
    if (model.includes('o1-preview')) return 'o1 Preview';
    return 'o1';
  }
  if (model.includes('chatgpt-4o-latest')) return 'ChatGPT 4o';
  if (model.includes('gpt-4')) {
    if (model.includes('gpt-4o-mini')) return 'GPT-4o mini';
    if (model.includes('gpt-4o')) return 'GPT-4o';
    if (model.includes('gpt-4-0125-preview')
      || model.includes('gpt-4-1106-preview')
      || model.includes('gpt-4-turbo')
    ) return 'GPT-4 Turbo';
    if (model.includes('gpt-4-32k')) return 'GPT-4-32k';
    return 'GPT-4';
  }
  if (model.includes('gpt-3')) {
    if (model.includes('gpt-3.5-turbo-instruct')) return 'GPT-3.5 Turbo Instruct';
    if (model.includes('gpt-3.5-turbo')) return 'GPT-3.5 Turbo';
    if (model.includes('gpt-35-turbo')) return 'GPT-3.5 Turbo';
  }
  // [LocalAI?]
  if (model.endsWith('.bin')) return model.slice(0, -4);
  // [Anthropic]
  const prettyAnthropic = _prettyAnthropicModelName(model);
  if (prettyAnthropic) return prettyAnthropic;
  // [Deepseek]
  if (model.includes('deepseek-chat')) return 'Deepseek Chat';
  if (model.includes('deepseek-coder')) return 'Deepseek Coder';
  // [LM Studio]
  if (model.startsWith('C:\\') || model.startsWith('D:\\'))
    return _prettyLMStudioFileModelName(model).replace('.gguf', '');
  // [Mistral]
  if (model.includes('mistral-large')) return 'Mistral Large';
  // [Ollama]
  if (model.includes(':'))
    return model.replace(':latest', '').replaceAll(':', ' ');
  // [xAI]
  if (model.includes('grok-beta')) return 'Grok Beta';
  return model;
}

function _prettyAnthropicModelName(modelId: string): string | null {
  const claudeIndex = modelId.indexOf('claude-3');
  if (claudeIndex === -1) return null;

  const subStr = modelId.slice(claudeIndex);
  const is35 = subStr.includes('-3-5-');
  const version = is35 ? '3.5' : '3';

  if (subStr.includes(`-opus`)) return `Claude ${version} Opus`;
  if (subStr.includes(`-sonnet`)) return `Claude ${version} Sonnet`;
  if (subStr.includes(`-haiku`)) return `Claude ${version} Haiku`;

  return `Claude ${version}`;
}

function _prettyLMStudioFileModelName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}
