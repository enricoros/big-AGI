import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import { Avatar, Box } from '@mui/joy';
import Face6Icon from '@mui/icons-material/Face6';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { findModelVendor } from '~/modules/llms/vendors/vendors.registry';

import type { MetricsChatGenerateCost_Md } from '~/common/stores/metrics/metrics.chatgenerate';
import type { DMessage, DMessageGenerator, DMessageRole } from '~/common/stores/chat/chat.message';
import type { UIComplexityMode } from '~/common/app.theme';
import { PhPaintBrush } from '~/common/components/icons/phosphor/PhPaintBrush';
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
      const isTextToImage =
        messageGeneratorName?.startsWith('GPT Image') // sync this with t2i.client.ts
        || messageGeneratorName?.startsWith('DALL·E')
        || messageGeneratorName === 'Prodia';
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
        return <PhPaintBrush sx={!messageIncomplete ? avatarIconSx : {
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

  // OPTIMIZATION - THIS COULD BACKFIRE - THE ICON MAY NOT BE UPDATED AS OFTEN AS WE NEED
  // -> we will only trigger updates on: updated, pendingIncomplete changes, name changes
  // generator will change at every step (due to some structuredClone in AIX); we choose to 'lag' behind it and
  // refresh this when other variables change
  const laggedGeneratorRef = React.useRef<DMessageGenerator | undefined>(undefined);
  laggedGeneratorRef.current = generator;
  const generatorName = generator?.name ?? '';

  return React.useMemo(() => {
    if (created === undefined) {
      return {
        label: 'unk-msg',
        tooltip: null,
      };
    }
    const generator = laggedGeneratorRef.current;
    if (!generator) {
      return {
        label: 'unk-model',
        tooltip: null,
      };
    }

    // incomplete: just the name
    const prettyName = prettyShortChatModelName(generatorName);
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
    const metrics = generator.metrics ? _prettyMetrics(generator.metrics, complexity) : null;
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
  }, [complexity, created, generatorName, pendingIncomplete, updated]);
}

function _prettyMetrics(metrics: DMessageGenerator['metrics'], uiComplexityMode: UIComplexityMode): React.ReactNode {
  if (!metrics) return null;

  const showWaitingTime = metrics?.dtStart !== undefined && (uiComplexityMode === 'extra' || metrics.dtStart >= 10000);
  const showSpeedSection = uiComplexityMode !== 'minimal' && (showWaitingTime || metrics?.vTOutInner !== undefined);

  const costCode = metrics.$code ? _prettyCostCode(metrics.$code) : null;

  return <Box sx={tooltipMetricsGridSx}>

    {/* Tokens */}
    {metrics?.TIn !== undefined && <div>Tokens:</div>}
    {metrics?.TIn !== undefined && <div>
      {' '}<b>{metrics.TIn?.toLocaleString() || ''}</b> in
      {metrics.TCacheRead !== undefined && <>{' · '}<b>{metrics.TCacheRead?.toLocaleString() || ''}</b> read</>}
      {metrics.TCacheWrite !== undefined && <>{' · '}<b>{metrics.TCacheWrite?.toLocaleString() || ''}</b> wrote</>}
      {', '}<b>{metrics.TOut?.toLocaleString() || ''}</b> out
      {metrics.TOutR !== undefined && <> (<b>{metrics.TOutR?.toLocaleString() || ''}</b> for reasoning)</>}
      {/*{metrics.TOutA !== undefined && <> (<b>{metrics.TOutA?.toLocaleString() || ''}</b> for audio)</>}*/}
    </div>}

    {/* Timings */}
    {showSpeedSection && <div>Speed:</div>}
    {showSpeedSection && <div>
      {!!metrics.vTOutInner && <>~<b>{(Math.round(metrics.vTOutInner * 10) / 10).toLocaleString() || ''}</b> tok/s</>}
      {showWaitingTime && (<span style={{ opacity: 0.5 }}>
        {metrics.vTOutInner !== undefined && ' · '}
        <span>{(Math.round(metrics.dtStart! / 100) / 10).toLocaleString() || ''}</span>s wait
      </span>)}
    </div>}

    {/* Costs */}
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
    {costCode && metrics?.$c !== undefined ? <div>Costs:</div> : <div />}
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


const oaiORegex = /gpt-[345](?:o|\.\d+)?-|o[1345]-|chatgpt-4o|computer-use-/;
const geminiRegex = /gemini-|gemma-|learnlm-/;


/** Pretty name for a chat model ID - VERY HARDCODED - shall use the Avatar Label-style code instead */
export function prettyShortChatModelName(model: string | undefined): string {
  if (!model) return '';

  // TODO: fully reform this function to be using information from the DLLM, rather than this manual mapping

  // [OpenAI]
  let prefixIndex = model.search(oaiORegex);
  if (prefixIndex !== -1) {
    let cutModel = prefixIndex === -1 ? model : model.slice(prefixIndex);
    // remove version: cut before the '-202..' if present
    const versionIndex = cutModel.search(/-20\d{2}/);
    if (versionIndex !== -1) cutModel = cutModel.slice(0, versionIndex);
    return cutModel
      .replace('chatgpt-', 'ChatGPT_')
      .replace('gpt-', 'GPT_')
      // feature variants
      .replace('-audio', ' Audio')
      .replace('-realtime-preview', ' Realtime')
      .replace('-realtime', ' Realtime')
      .replace('-search-preview', ' Search')
      .replace('-search', ' Search')
      .replace('-tts', ' TTS')
      .replace('-turbo', ' Turbo')
      // price variants
      .replace('-pro', ' Pro')
      .replace('-preview', ' (preview)')
      // .replace('-latest', ' latest') // covered by catch-all
      // size (covered by catch-all)
      // .replace('-mini', ' mini')
      // .replace('-micro', ' micro')
      // .replace('-nano', ' nano')
      // catch-all
      .replaceAll('-', ' ')
      .replaceAll('_', '-');
  }
  // [LocalAI?]
  if (model.endsWith('.bin')) return model.slice(0, -4);
  // [Alibaba]
  if (model.startsWith('alibaba-qwen-') || model.startsWith('qwen-')) {
    return model
      .replace('alibaba-', ' ')
      .replace('qwen', 'Qwen')
      .replace('max', 'Max')
      .replace('plus', 'Plus')
      .replace('turbo', 'Turbo')
      .replaceAll('-', ' ');
  }
  // [Anthropic]
  const prettyAnthropic = _prettyAnthropicModelName(model);
  if (prettyAnthropic) return prettyAnthropic;
  // [Gemini]
  prefixIndex = model.search(geminiRegex);
  if (prefixIndex !== -1) {
    let cutModel = prefixIndex === -1 ? model : model.slice(prefixIndex);
    // Check for -NN-NN at the end (e.g., -05-15)
    let datePattern = '';
    const dateMatch = cutModel.match(/-(\d{2}-\d{2})$/);
    if (dateMatch) {
      datePattern = ' ' + dateMatch[1]; // extract '05-15'
      cutModel = cutModel.slice(0, cutModel.length - dateMatch[0].length); // remove '-05-15'
    }
    const geminiName = cutModel
      .replace('non-thinking', '') // NOTE: this is our variant, injected in gemini.models.ts
      .replaceAll('-', ' ')
      // products
      .replace('gemini', 'Gemini')
      .replace('gemma', 'Gemma')
      .replace('learnlm', 'LearnLM')
      // price variants
      .replace('pro', 'Pro')
      .replace('flash', 'Flash')
      // feature variants
      .replace('generation', 'Gen')
      .replace('image', 'Image')
      .replace('thinking', 'Thinking')
      .replace('preview', '')
      .replace('experimental', 'exp')
      .replace('exp', '(exp)');
    return geminiName + datePattern;
  }
  // [Deepseek]
  if (model.includes('deepseek-')) {
    // start past the last /, if any
    const lastSlashIndex = model.lastIndexOf('/');
    const modelName = lastSlashIndex === -1 ? model : model.slice(lastSlashIndex + 1);
    return modelName.replace('deepseek-', ' Deepseek ')
      .replace('reasoner', 'R1').replace('r1', 'R1')
      .replaceAll('-', ' ')
      .trim();
  }
  // [LM Studio]
  if (model.startsWith('C:\\') || model.startsWith('D:\\'))
    return _prettyLMStudioFileModelName(model).replace('.gguf', '');
  // [Mistral]
  if (model.includes('mistral-large')) return 'Mistral Large';
  // [Ollama]
  if (model.includes(':'))
    return model.replace(':latest', '').replaceAll(':', ' ');
  // [Perplexity]
  if (model.includes('sonar-')) {
    // capitalize each component of the name, e.g. 'sonar-pro' -> 'Sonar Pro'
    return model.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
  }
  // [xAI]
  if (model.includes('grok-')) {
    if (model.includes('grok-3') || model.includes('grok-2')) {
      return model
        .replace('xai-', '')
        .replace('-beta', '')
        .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }
    if (model.includes('grok-beta')) return 'Grok Beta';
    if (model.includes('grok-vision-beta')) return 'Grok Vision Beta';
  }
  // [FireworksAI]
  if (model.includes('accounts/')) {
    const index = model.indexOf('accounts/');
    const subStr = model.slice(index + 9);
    return subStr.replaceAll('/models/', ' · ').replaceAll(/[_-]/g, ' ');
  }
  return model;
}

function _prettyAnthropicModelName(modelId: string): string | null {
  const claudeIndex = modelId.indexOf('claude-3');
  if (claudeIndex === -1) return null;

  const subStr = modelId.slice(claudeIndex);
  const version =
    subStr.includes('-3-7-') ? '3.7'
      : subStr.includes('-3-5-') ? '3.5'
        : '3';

  if (subStr.includes(`-opus`)) return `Claude ${version} Opus`;
  if (subStr.includes(`-sonnet`)) return `Claude ${version} Sonnet`;
  if (subStr.includes(`-haiku`)) return `Claude ${version} Haiku`;

  return `Claude ${version}`;
}

function _prettyLMStudioFileModelName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}
