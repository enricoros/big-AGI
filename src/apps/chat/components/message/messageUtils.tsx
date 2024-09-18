import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box } from '@mui/joy';
import Face6Icon from '@mui/icons-material/Face6';
import FormatPaintOutlinedIcon from '@mui/icons-material/FormatPaintOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { SystemPurposeId, SystemPurposes } from '../../../../data';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { ChatGenerateCostMetricsMd } from '~/common/stores/metrics/metrics.chatgenerate';
import type { DMessage, DMessageGenerator, DMessageRole } from '~/common/stores/chat/chat.message';
import type { UIComplexityMode } from '~/common/app.theme';
import { animationColorRainbow } from '~/common/util/animUtils';
import { formatModelsCost } from '~/common/util/costUtils';


// Animations
const ANIM_BUSY_DOWNLOADING = 'https://i.giphy.com/26u6dIwIphLj8h10A.webp'; // hourglass: https://i.giphy.com/TFSxpAIYz5inJGuY8f.webp, small-lq: https://i.giphy.com/131tNuGktpXGhy.webp, floppy: https://i.giphy.com/RxR1KghIie2iI.webp
const ANIM_BUSY_PAINTING = 'https://i.giphy.com/media/5t9ujj9cMisyVjUZ0m/giphy.webp';
const ANIM_BUSY_THINKING = 'https://i.giphy.com/media/l44QzsOLXxcrigdgI/giphy.webp';
export const ANIM_BUSY_TYPING = 'https://i.giphy.com/media/jJxaUysjzO9ri/giphy.webp';


export const messageAsideColumnSx: SxProps = {
  // make this stick to the top of the screen
  position: 'sticky',
  top: '0.25rem',

  // style
  // filter: 'url(#agi-holographic)',

  // flexBasis: 0, // this won't let the item grow
  minWidth: { xs: 50, md: 64 },
  maxWidth: 80,
  textAlign: 'center',
  // layout
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.25, // 2024-08-24: added, space the avatar icon from the label

  // when with the 'edit-button' class
  '&.msg-edit-button': {
    gap: 0.25,
  },
};

export const messageZenAsideColumnSx: SxProps = {
  ...messageAsideColumnSx,
  minWidth: undefined,
  maxWidth: undefined,
  mx: -1,
};

export const messageAvatarLabelSx: SxProps = {
  overflowWrap: 'anywhere',
};

export const messageAvatarLabelAnimatedSx: SxProps = {
  animation: `${animationColorRainbow} 5s linear infinite`,
};

export const aixSkipBoxSx = {
  height: 36,
  width: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const aixSkipIconSx = {
  color: 'neutral.solidBg',
};

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


export function makeMessageAvatarIcon(
  uiComplexityMode: UIComplexityMode,
  messageRole: DMessageRole | string,
  messageGeneratorName: string | undefined,
  messagePurposeId: SystemPurposeId | string | undefined,
  messageIncomplete: boolean,
  messageFlagAixSkip: boolean,
  larger: boolean,
): React.JSX.Element {

  const nameOfRole =
    messageRole === 'user' ? 'You'
      : messageRole === 'assistant' ? 'Assistant'
        : 'System';

  // if skipped, just return the skip symbol
  if (messageFlagAixSkip)
    return <Box sx={aixSkipBoxSx}><VisibilityOffOutlinedIcon sx={aixSkipIconSx} /></Box>;

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


/// Avatar Label & Label Tooltip

const avatarLabelTooltipSx: SxProps = {
  fontSize: 'sm',
  p: 1,
  display: 'grid',
  gap: 1,
};

const avatarLabelTooltipIconContainerSx: SxProps = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const avatarLabelCreated: SxProps = {
  fontSize: 'xs',
  color: 'text.tertiary',
};

export function useMessageAvatarLabel({ generator, pendingIncomplete, created, updated }: Pick<DMessage, 'generator' | 'pendingIncomplete' | 'created' | 'updated'>, complexity: UIComplexityMode): { label: React.ReactNode, tooltip: React.ReactNode } {
  return React.useMemo(() => {
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
          <Box sx={avatarLabelTooltipSx}>
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
        <Box sx={avatarLabelTooltipSx}>
          {VendorIcon ? <Box sx={avatarLabelTooltipIconContainerSx}><VendorIcon />{generator.name}</Box> : <div>{generator.name}</div>}
          {(modelId && complexity === 'extra') && <div>{modelId}</div>}
          {metrics && <div>{metrics}</div>}
          {stopReason && <div>{stopReason}</div>}
          {complexity === 'extra' && !!created && <Box sx={avatarLabelCreated}>{updated ? 'Updated' : 'Created'} <TimeAgo date={updated || created} />.</Box>}
        </Box>
      ),
    };
  }, [complexity, created, generator, pendingIncomplete, updated]);
}

const metricsGridSx: SxProps = {
  // grid of 2 columns, the first fits the labels, the other expends with the values
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
  gap: 0.5,
};

function _prettyMetrics(metrics: DMessageGenerator['metrics']): React.ReactNode {
  if (!metrics) return null;
  const costCode = metrics.$code ? _prettyCostCode(metrics.$code) : null;
  return <Box sx={metricsGridSx}>
    {metrics?.TIn !== undefined && <div>Tokens:</div>}
    {metrics?.TIn !== undefined && <div>
      {' '}<b>{metrics.TIn?.toLocaleString() || ''}</b> in
      {metrics.TCacheRead !== undefined && <>{', '}<b>{metrics.TCacheRead?.toLocaleString() || ''}</b> read</>}
      {metrics.TCacheWrite !== undefined && <>{', '}<b>{metrics.TCacheWrite?.toLocaleString() || ''}</b> wrote</>}
      {', '}<b>{metrics.TOut?.toLocaleString() || ''}</b> out
      {metrics.TOutR !== undefined && <> (<b>{metrics.TOutR?.toLocaleString() || ''}</b> for reasoning)</>}
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

function _prettyCostCode(code: ChatGenerateCostMetricsMd['$code']): string | null {
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
      return complexity === 'extra' ? 'Stopped' : '';
    case 'filter':
      return 'Filtered';
    case 'issue':
      return complexity === 'extra' ? 'Error' : '';
    case 'out-of-tokens':
      return 'Out of Tokens';
  }
}


/// Base Model pretty name from the model ID - VERY HARDCODED - shall use the Avatar Label-style code instead

export function prettyShortChatModelName(model: string | undefined): string {
  if (!model) return '';

  // TODO: fully reform this function to be using information from the DLLM, rather than this manual mapping

  // [OpenAI]
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
  // [LM Studio]
  if (model.startsWith('C:\\') || model.startsWith('D:\\'))
    return _prettyLMStudioFileModelName(model).replace('.gguf', '');
  // [Ollama]
  if (model.includes(':'))
    return model.replace(':latest', '').replaceAll(':', ' ');
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
