import * as React from 'react';
import TimeAgo from 'react-timeago';

import type { SxProps } from '@mui/joy/styles/types';
import type { ColorPaletteProp } from '@mui/joy/styles';
import { Avatar, Box } from '@mui/joy';
import Face6Icon from '@mui/icons-material/Face6';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';

import { SystemPurposeId, SystemPurposes } from '../../data';

import { llmsGetVendorIcon } from '~/modules/llms/components/LLMVendorIcon';

import type { MetricsChatGenerateCost_Md } from '~/common/stores/metrics/metrics.chatgenerate';
import type { DConversationParticipant } from '~/common/stores/chat/chat.conversation';
import type { DMessage, DMessageAuthor, DMessageGenerator, DMessageRole } from '~/common/stores/chat/chat.message';
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

// const largerAvatarIconsSx = {
//   borderRadius: 'sm',
//   width: 48,
//   height: 48,
// };

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
  columnGap: 1,
  rowGap: 0.5,
};

const participantAccentColors = ['primary', 'success', 'warning', 'danger'] as const satisfies readonly ColorPaletteProp[];

type ParticipantAccentTokens = {
  hue: number;
  softColor: string;
  softBg: string;
  solidColor: string;
  solidBg: string;
  outlinedColor: string;
  outlinedBg: string;
  outlinedBorder: string;
};
const participantAccentMentionSxByColor: Record<ColorPaletteProp, React.CSSProperties> = {
  primary: { color: 'var(--joy-palette-primary-softColor)', backgroundColor: 'var(--joy-palette-primary-softBg)' },
  success: { color: 'var(--joy-palette-success-softColor)', backgroundColor: 'var(--joy-palette-success-softBg)' },
  warning: { color: 'var(--joy-palette-warning-softColor)', backgroundColor: 'var(--joy-palette-warning-softBg)' },
  danger: { color: 'var(--joy-palette-danger-softColor)', backgroundColor: 'var(--joy-palette-danger-softBg)' },
  neutral: { color: 'var(--joy-palette-neutral-softColor)', backgroundColor: 'var(--joy-palette-neutral-softBg)' },
};

function normalizeParticipantAccentKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

function getParticipantRosterIndex(name: string | null | undefined, participants?: readonly DConversationParticipant[] | null): { index: number; total: number } | null {
  const normalizedName = normalizeParticipantAccentKey(name);
  if (!normalizedName || !participants?.length)
    return null;

  const assistantNames = Array.from(new Set(
    participants
      .filter(participant => participant.kind === 'assistant')
      .map(participant => normalizeParticipantAccentKey(participant.name))
      .filter(Boolean),
  )).sort((a, b) => a.localeCompare(b));

  const index = assistantNames.indexOf(normalizedName);
  if (index === -1 || !assistantNames.length)
    return null;

  return { index, total: assistantNames.length };
}

function getParticipantAccentHue(name: string | null | undefined, participants?: readonly DConversationParticipant[] | null): number | null {
  const normalizedName = normalizeParticipantAccentKey(name);
  if (!normalizedName)
    return null;

  const persistedParticipant = participants?.find(participant =>
    participant.kind === 'assistant'
    && normalizeParticipantAccentKey(participant.name) === normalizedName
    && typeof participant.accentHue === 'number'
    && Number.isFinite(participant.accentHue),
  );
  if (persistedParticipant)
    return Math.round((((persistedParticipant.accentHue! % 360) + 360) % 360));

  const rosterIndex = getParticipantRosterIndex(name, participants);
  if (rosterIndex) {
    const total = Math.max(rosterIndex.total, 1);
    const step = 360 / total;
    const baseHue = 210;
    return Math.round((baseHue + rosterIndex.index * step) % 360);
  }

  let hash = 0;
  for (let index = 0; index < normalizedName.length; index++)
    hash = ((hash << 5) - hash + normalizedName.charCodeAt(index)) | 0;

  return Math.abs(hash) % 360;
}

function getContrastTextColor(backgroundColor: string): string {
  const hslMatch = backgroundColor.match(/hsl\(\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)/i);
  if (!hslMatch)
    return 'var(--joy-palette-common-white, #ffffff)';

  const hue = Number(hslMatch[1]);
  const saturation = Number(hslMatch[2]) / 100;
  const lightness = Number(hslMatch[3]) / 100;

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1)
    [red, green, blue] = [chroma, secondary, 0];
  else if (huePrime < 2)
    [red, green, blue] = [secondary, chroma, 0];
  else if (huePrime < 3)
    [red, green, blue] = [0, chroma, secondary];
  else if (huePrime < 4)
    [red, green, blue] = [0, secondary, chroma];
  else if (huePrime < 5)
    [red, green, blue] = [secondary, 0, chroma];
  else
    [red, green, blue] = [chroma, 0, secondary];

  const matchLightness = lightness - chroma / 2;
  const [r, g, b] = [red + matchLightness, green + matchLightness, blue + matchLightness].map(channel => {
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;

  return whiteContrast >= blackContrast ? 'var(--joy-palette-common-white, #ffffff)' : 'var(--joy-palette-common-black, #000000)';
}

function getParticipantAccentTokens(name: string | null | undefined, participants?: readonly DConversationParticipant[] | null): ParticipantAccentTokens | null {
  const hue = getParticipantAccentHue(name, participants);
  if (hue === null)
    return null;

  const softBg = `hsl(${hue} 72% 38%)`;
  const solidBg = `hsl(${hue} 74% 46%)`;
  const outlinedBg = `hsl(${hue} 66% 30%)`;

  return {
    hue,
    softColor: getContrastTextColor(softBg),
    softBg,
    solidColor: getContrastTextColor(solidBg),
    solidBg,
    outlinedColor: getContrastTextColor(outlinedBg),
    outlinedBg,
    outlinedBorder: `hsl(${hue} 58% 52%)`,
  };
}

export function getParticipantAccentColor(name: string | null | undefined, participants?: readonly DConversationParticipant[] | null): ColorPaletteProp {
  const hue = getParticipantAccentHue(name, participants);
  if (hue === null)
    return 'neutral';

  return participantAccentColors[Math.floor((hue / 360) * participantAccentColors.length) % participantAccentColors.length] ?? 'neutral';
}

export function getParticipantAccentSx(name: string | null | undefined, participants?: readonly DConversationParticipant[] | null, tone: 'soft' | 'solid' | 'outlined' = 'soft'): SxProps {
  const tokens = getParticipantAccentTokens(name, participants);
  if (!tokens)
    return {};

  if (tone === 'solid') {
    return {
      color: tokens.solidColor,
      backgroundColor: tokens.solidBg,
      borderColor: tokens.solidBg,
    } satisfies SxProps;
  }

  if (tone === 'outlined') {
    return {
      color: tokens.outlinedColor,
      borderColor: tokens.outlinedBorder,
      backgroundColor: tokens.outlinedBg,
    } satisfies SxProps;
  }

  return {
    color: tokens.softColor,
    backgroundColor: tokens.softBg,
    borderColor: tokens.outlinedBorder,
  } satisfies SxProps;
}

const participantAccentMinimapAttrsByColor: Record<ColorPaletteProp, { backgroundColor: string; borderColor: string; }> = {
  primary: {
    backgroundColor: 'var(--joy-palette-primary-softBg)',
    borderColor: 'var(--joy-palette-primary-outlinedBorder)',
  },
  success: {
    backgroundColor: 'var(--joy-palette-success-softBg)',
    borderColor: 'var(--joy-palette-success-outlinedBorder)',
  },
  warning: {
    backgroundColor: 'var(--joy-palette-warning-softBg)',
    borderColor: 'var(--joy-palette-warning-outlinedBorder)',
  },
  danger: {
    backgroundColor: 'var(--joy-palette-danger-softBg)',
    borderColor: 'var(--joy-palette-danger-outlinedBorder)',
  },
  neutral: {
    backgroundColor: 'var(--joy-palette-neutral-softBg)',
    borderColor: 'var(--joy-palette-neutral-outlinedBorder)',
  },
};

export function getChatMessageMinimapAccentDataAttributes(fromAssistant: boolean, accentColor: ColorPaletteProp, accentSx: SxProps | undefined): {
  backgroundColor?: string;
  borderColor?: string;
} {
  if (!fromAssistant)
    return {};

  const paletteAttrs = participantAccentMinimapAttrsByColor[accentColor];
  if (paletteAttrs)
    return paletteAttrs;

  if (!accentSx || typeof accentSx !== 'object')
    return {};

  return {
    backgroundColor: 'backgroundColor' in accentSx && typeof accentSx.backgroundColor === 'string'
      ? accentSx.backgroundColor
      : undefined,
    borderColor: 'borderColor' in accentSx && typeof accentSx.borderColor === 'string'
      ? accentSx.borderColor
      : undefined,
  };
}

export function getParticipantMentionSx(name: string | null | undefined, clickable = false, participants?: readonly DConversationParticipant[] | null): SxProps {
  const accentSx = getParticipantAccentSx(name, participants, 'soft') as React.CSSProperties;

  return {
    ...(Object.keys(accentSx).length ? accentSx : participantAccentMentionSxByColor[getParticipantAccentColor(name, participants)]),
    display: 'inline-flex',
    alignItems: 'center',
    border: 'none',
    borderRadius: '0.5rem',
    paddingInline: '0.3em',
    paddingBlock: '0.05em',
    font: 'inherit',
    fontWeight: 600,
    lineHeight: 'inherit',
    textDecoration: 'none',
    verticalAlign: 'baseline',
    boxShadow: clickable ? 'sm' : undefined,
    cursor: clickable ? 'pointer' : 'inherit',
    transition: 'background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
    '&:hover': clickable ? {
      filter: 'saturate(1.1)',
      boxShadow: 'md',
    } : undefined,
    '&:active': clickable ? {
      transform: 'translateY(1px)',
    } : undefined,
  } satisfies SxProps;
}
const allParticipantMentionRegex = /(^|[^\w])(@all(?=$|[^\w]))/gu;

export interface ParticipantMentionMatch {
  mentionText: string;
  mentionName: string;
  mentionStart: number;
  mentionEnd: number;
}

export function escapeParticipantMentionToken(token: string): string {
  return token.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getParticipantMentionAliases(name: string): string[] {
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName)
    return [];

  return Array.from(new Set([
    normalizedName,
    ...normalizedName.split('/').map(segment => segment.trim().replace(/\s+/g, ' ')).filter(Boolean),
  ]));
}

function normalizeParticipantMentionName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function isMentionBoundaryChar(char: string | undefined): boolean {
  return !char || /[\s.,!?;:)}\]"'”’،。！？]/u.test(char);
}

function collectAllParticipantMentions(text: string): ParticipantMentionMatch[] {
  const matches: ParticipantMentionMatch[] = [];
  let match: RegExpExecArray | null;

  allParticipantMentionRegex.lastIndex = 0;
  while ((match = allParticipantMentionRegex.exec(text)) !== null) {
    const mentionText = match[2] ?? '';
    if (!mentionText)
      continue;

    const matchStart = match.index;
    const mentionStart = matchStart + ((match[0] ?? '').length - mentionText.length);
    const mentionName = mentionText.slice(1).trim();
    if (!mentionName)
      continue;

    matches.push({
      mentionText,
      mentionName,
      mentionStart,
      mentionEnd: mentionStart + mentionText.length,
    });
  }

  allParticipantMentionRegex.lastIndex = 0;
  return matches;
}

function getRosterMentionNames(participants?: readonly DConversationParticipant[] | null): string[] {
  if (!participants?.length)
    return [];

  return Array.from(new Set(
    participants
      .filter(participant => participant.kind === 'assistant')
      .flatMap(participant => getParticipantMentionAliases(participant.name))
      .filter(Boolean),
  ));
}

export function findParticipantMentionMatchIndex(text: string, participantName: string): number | null {
  const aliases = getParticipantMentionAliases(participantName)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));

  let bestMatch: { index: number; aliasLength: number } | null = null;

  for (const alias of aliases) {
    const explicitMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])@${escapeParticipantMentionToken(alias)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    const explicitMatch = explicitMentionRegex.exec(text);
    if (explicitMatch) {
      const index = explicitMatch.index + ((explicitMatch[0] ?? '').length - (`@${alias}`).length);
      if (!bestMatch || index < bestMatch.index || (index === bestMatch.index && alias.length > bestMatch.aliasLength))
        bestMatch = { index, aliasLength: alias.length };
      continue;
    }

    const bareMentionRegex = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeParticipantMentionToken(alias)}(?=$|[^\\p{L}\\p{N}])`, 'iu');
    const bareMatch = bareMentionRegex.exec(text);
    if (!bareMatch)
      continue;

    const index = bareMatch.index + ((bareMatch[0] ?? '').length - alias.length);
    if (!bestMatch || index < bestMatch.index || (index === bestMatch.index && alias.length > bestMatch.aliasLength))
      bestMatch = { index, aliasLength: alias.length };
  }

  return bestMatch?.index ?? null;
}

export function findParticipantMentions(text: string, participants?: readonly DConversationParticipant[] | null): ParticipantMentionMatch[] {
  const rosterMentionNames = getRosterMentionNames(participants)
    .sort((a, b) => b.length - a.length || a.localeCompare(b));

  if (!rosterMentionNames.length)
    return collectAllParticipantMentions(text);

  const normalizedRoster = rosterMentionNames.map(name => ({
    rawName: name,
    normalizedName: normalizeParticipantMentionName(name),
  }));

  const matches: ParticipantMentionMatch[] = [];

  for (let index = 0; index < text.length; index++) {
    if (text[index] !== '@')
      continue;

    const previousChar = index > 0 ? text[index - 1] : undefined;
    if (previousChar && /[\p{L}\p{N}_]/u.test(previousChar))
      continue;

    const afterAt = text.slice(index + 1);
    const normalizedAfterAt = normalizeParticipantMentionName(afterAt);

    if (normalizedAfterAt.startsWith('all') && isMentionBoundaryChar(afterAt[3])) {
      matches.push({
        mentionText: '@all',
        mentionName: 'all',
        mentionStart: index,
        mentionEnd: index + 4,
      });
      index += 3;
      continue;
    }

    const matchedRosterName = normalizedRoster.find(({ normalizedName }) =>
      normalizedAfterAt.startsWith(normalizedName) && isMentionBoundaryChar(afterAt[normalizedName.length]),
    );

    if (!matchedRosterName)
      continue;

    const mentionText = `@${matchedRosterName.rawName}`;
    matches.push({
      mentionText,
      mentionName: matchedRosterName.rawName,
      mentionStart: index,
      mentionEnd: index + mentionText.length,
    });
    index += mentionText.length - 1;
  }

  return matches;
}


/** Whole message background color, based on the message role and state */
export function messageBackground(messageRole: DMessageRole | string, userCommand: 'draw' | 'react' | false, wasEdited: boolean, isAssistantIssue: boolean): string {
  switch (messageRole) {
    case 'user':
      return userCommand === 'draw' ? 'warning.softActiveBg'
        : userCommand === 'react' ? 'success.softHoverBg'
          : 'primary.plainHoverBg'; // was .background.level1
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
  messageAuthor: DMessageAuthor | undefined,
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
            sx={avatarIconSx}
            // sx={larger ? largerAvatarIconsSx : avatarIconSx}
          />;

        // Purpose image (if present)
        const purposeImage = SystemPurposes[(messageAuthor?.personaId ?? messagePurposeId) as SystemPurposeId]?.imageUri ?? undefined;
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
      const symbol = SystemPurposes[(messageAuthor?.personaId ?? messagePurposeId) as SystemPurposeId]?.symbol;
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
  messageParts: Pick<DMessage, 'generator' | 'pendingIncomplete' | 'created' | 'updated' | 'metadata'> | undefined,
  complexity: UIComplexityMode,
): { label: React.ReactNode; tooltip: React.ReactNode } {

  // we do this for performance reasons, to only limit re-renders to these parts of the message
  const { generator, pendingIncomplete, created, updated, metadata } = messageParts || {};

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
        label: metadata?.author?.participantName || 'unk-model',
        tooltip: metadata?.author?.participantName || null,
      };
    }

    // Prefer the conversation participant / agent name in the compact badge label.
    // The underlying model remains available in the tooltip/details.
    const authorName = metadata?.author?.participantName?.trim() || null;
    const prettyName = prettyShortChatModelName(generatorName);
    const compactLabel = authorName || prettyName;
    if (pendingIncomplete)
      return {
        label: compactLabel,
        tooltip: (!created || complexity === 'minimal') ? null : (
          <Box sx={tooltipSx}>
            <TimeAgo date={created} formatter={(value: number, unit: string, _suffix: string) => `Thinking for ${value} ${unit}${value > 1 ? 's' : ''}...`} />
          </Box>
        ),
      };

    // named generator: nothing else to do there
    if (generator.mgt === 'named')
      return {
        label: compactLabel,
        tooltip: prettyName !== generator.name ? `${authorName ? `${authorName} · ` : ''}${generator.name}` : (authorName || null),
      };

    // aix generator: details galore
    const modelId = generator.aix?.mId ?? null;
    const vendorId = generator.aix?.vId ?? null;
    const VendorIcon = (vendorId && complexity !== 'minimal') ? llmsGetVendorIcon(vendorId) : null;
    const metrics = generator.metrics ? _prettyMetrics(generator.metrics, complexity) : null;
    const stopReason = generator.tokenStopReason ? _prettyTokenStopReason(generator.tokenStopReason, complexity) : null;

    // aix tooltip: more details
    return {
      label: (stopReason && complexity !== 'minimal') ? <>{compactLabel} <small>({stopReason})</small></> : compactLabel,
      tooltip: complexity === 'minimal' ? null : (
        <Box sx={tooltipSx}>
          {VendorIcon ? <Box sx={tooltipIconContainerSx}><VendorIcon />{generator.name}</Box> : <div>{generator.name}</div>}
          {generator.providerInfraLabel && <div>{vendorId} -&gt; via &lsquo;{generator.providerInfraLabel}&rsquo;</div>}
          {(modelId && complexity === 'extra') && <div>{modelId}</div>}
          {metrics && <div>{metrics}</div>}
          {stopReason && <div>{stopReason}</div>}
          {complexity === 'extra' && !!created && <Box sx={tooltipCreationTimeSx}>{updated ? 'Updated' : 'Created'} <TimeAgo date={updated || created} />.</Box>}
        </Box>
      ),
    };
  }, [complexity, created, generatorName, metadata?.author?.participantName, pendingIncomplete, updated]);
}

function _prettyMetrics(metrics: DMessageGenerator['metrics'], uiComplexityMode: UIComplexityMode): React.ReactNode {
  if (!metrics) return null;

  const showWaitingTime = metrics?.dtStart !== undefined && (uiComplexityMode === 'extra' || metrics.dtStart >= 10000);
  const showSpeedSection = uiComplexityMode !== 'minimal' && (showWaitingTime || metrics?.vTOutInner !== undefined);
  const showTimeSection = showSpeedSection && !!metrics?.dtAll;

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
    {/* Add the 'reported' costs underneath, if defined */}
    {metrics?.$cReported !== undefined && <div>{metrics?.$c !== undefined ? '' : 'Costs:'}</div>}
    {metrics?.$cReported !== undefined && <div>
      <small>reported: <b>{formatModelsCost(metrics.$cReported / 100)}</b></small>
    </div>}
    {/* Add the cost 'code' underneath, if any */}
    {costCode && <div>{(metrics?.$c !== undefined || metrics?.$cReported !== undefined) ? '' : 'Costs:'}</div>}
    {costCode && <div><em>{costCode}</em></div>}

    {/* Time */}
    {showTimeSection && <div>Time:</div>}
    {showTimeSection && <div><b>{(Math.round(metrics.dtAll! / 100) / 10).toLocaleString()}</b> s</div>}
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
    default:
      const _exhaustiveCheck: never = reason;
      return null;
  }
}


const oaiORegex = /gpt-[345](?:o|\.\d+)?-|o[1345]-|osb-|chatgpt-[45]o?|gpt-5-chat|computer-use-/;
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
      .replace('gpt-5-chat-', 'ChatGPT-5 ')
      .replace('gpt-', 'GPT_')
      .replace('osb-', 'OSB_')
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
      // commercial aliases
      .replace('gemini-3-pro-image', 'Nano Banana Pro')
      .replace('gemini-2.5-flash-image', 'Nano Banana')
      // root changes
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
      .replace('robotics er', 'Robotics')
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
    return modelName
      // map these for each release
      .replace('-reasoner', ' 3.2 Reasoner')
      .replace('-chat', ' 3.2 Chat')
      .replace('-v3', ' 3')
      // default replacements
      .replace('deepseek', 'Deepseek')
      .replace('speciale', 'Speciale').replace('@', ' ')
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
    if (['grok-code', 'grok-4', 'grok-3', 'grok-2'].some(m => model.includes(m))) {
      return model
        .replace('xai-', '')
        .replace('-beta', '')
        .replace('-non-reasoning', '')
        .split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }
    if (model.includes('grok-beta')) return 'Grok Beta';
    if (model.includes('grok-vision-beta')) return 'Grok Vision Beta';
  }
  // [Z.ai]
  if (model.startsWith('glm-')) {
    return model
      .replace('glm-', 'GLM-')
      .replace('ocr', 'OCR')
      .replace(/(\d)v/, '$1 V')   // vision suffix: 4.6v → 4.6 V
      .replace('-flashx', ' FlashX')
      .replace('-flash', ' Flash')
      .replace('-airx', ' AirX')
      .replace('-air', ' Air')
      .replace('-code', ' Code')
      .replace(/-x$/, ' X')
      .replace(/-32b.*$/, ' 32B');
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
  if (modelId.indexOf('claude-') === -1) return null; // not a Claude model

  // must match any known prefix
  let claudeIndex = -1;
  const claudePrefixes = ['claude-opus-4', 'claude-sonnet-4', 'claude-haiku-4', 'claude-3', 'claude-2'];
  for (const prefix of claudePrefixes) {
    const index = modelId.indexOf(prefix);
    if (index !== -1) {
      claudeIndex = index;
      break;
    }
  }

  const subStr = modelId.slice(claudeIndex);
  const version =
    subStr.includes('-4-6') ? '4.6'
      : subStr.includes('-4-5') ? '4.5' // fixes the -5
        : subStr.includes('-3-5') ? '3.5' // fixes the -5
          : subStr.includes('-5') ? '5'
            : subStr.includes('-4-1') ? '4.1'
              : subStr.includes('-4') ? '4'
                : subStr.includes('-3-7') ? '3.7'
                  : subStr.includes('-3') ? '3'
                    : '?';

  if (subStr.includes(`-opus`)) return `Claude Opus ${version}`;
  if (subStr.includes(`-sonnet`)) return `Claude Sonnet ${version}`;
  if (subStr.includes(`-haiku`)) return `Claude Haiku ${version}`;

  return `Claude ${version}`;
}

function _prettyLMStudioFileModelName(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || '';
}
