import * as React from 'react';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ConstructionIcon from '@mui/icons-material/Construction';
import FormatPaintTwoToneIcon from '@mui/icons-material/FormatPaintTwoTone';
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded';
import MicIcon from '@mui/icons-material/Mic';
import RecordVoiceOverRoundedIcon from '@mui/icons-material/RecordVoiceOverRounded';
import ScienceIcon from '@mui/icons-material/Science';
import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';

import type { PreferencesTabId } from '~/common/layout/optima/store-layout-optima';
import { PhVoice } from '~/common/components/icons/phosphor/PhVoice';


/**
 * Granular settings navigation ids. This is a subset of PreferencesTabId, which additionally
 * keeps the legacy alias 'chat' (resolved to 'appearance') for backward-compatible deep-links.
 * Every id here is a real, selectable nav node (top-level or sub-item).
 */
export type SettingsNavId =
  | 'appearance' | 'ai'
  | 'voice' | 'voice-in' | 'voice-out'
  | 'draw'
  | 'tools' | 'tools-browse' | 'tools-search'
  | 'labs';

export interface SettingsNavNode {
  id: SettingsNavId;
  label: string;
  path?: string;
  icon: React.ReactNode;
  description?: string; // subtitle shown on the parent 'hub' navigation cards
  children?: SettingsNavNode[];
}

/**
 * The ordered settings tree. Top-level items render all their sub-sections when selected;
 * sub-items render just themselves. Labs is intentionally last.
 */
export const SETTINGS_NAV: SettingsNavNode[] = [
  { id: 'ai', label: 'AI', icon: <AutoAwesomeIcon /> },
  { id: 'appearance', label: 'Appearance', icon: <TuneIcon /> },
  {
    id: 'voice', label: 'Voice', icon: <RecordVoiceOverRoundedIcon />,
    children: [
      { id: 'voice-in', label: 'Input', path: 'Voice > Input', icon: <MicIcon />, description: 'Microphone, language, transcription' },
      { id: 'voice-out', label: 'Output', path: 'Voice > Output', icon: <PhVoice />, description: 'Speech, voices, auto-speak' },
    ],
  },
  { id: 'draw', label: 'Draw', icon: <FormatPaintTwoToneIcon /> },
  {
    id: 'tools', label: 'Tools', icon: <ConstructionIcon />,
    children: [
      { id: 'tools-browse', label: 'Browsing', path: 'Tools > Browsing', icon: <LanguageRoundedIcon />, description: 'Load web pages into chats' },
      { id: 'tools-search', label: 'Custom Search', path: 'Tools > Custom Search', icon: <SearchIcon />, description: 'Google Programmable Search' },
    ],
  },
  { id: 'labs', label: 'Labs', icon: <ScienceIcon /> },
] as const;

export interface SettingsNavFlatItem {
  id: SettingsNavId;
  label: string;
  path?: string;
  icon: React.ReactNode;
  isChild: boolean;
}

/** Flattened view (children marked) for the mobile selector. */
export const SETTINGS_NAV_FLAT: SettingsNavFlatItem[] = SETTINGS_NAV.flatMap((node) => [
  { id: node.id, label: node.label, icon: node.icon, isChild: false },
  ...(node.children?.map((child) => ({ id: child.id, label: child.label, path: child.path, icon: child.icon, isChild: true })) ?? []),
]);


/** Map the external (possibly legacy/undefined) tab id to a concrete nav node id. */
export function resolveSettingsNavId(tab: PreferencesTabId): SettingsNavId {
  if (tab === undefined || tab === 'chat') {
    // NOTE: always start from the 'ai' configuration, it's most likely that something has
    //       to be changed there
    // return !llmsStoreState().sources?.length ? 'ai' : 'appearance';
    return 'appearance';
  }
  // every remaining PreferencesTabId member coincides with a SettingsNavId
  return tab;
}

/** The sub-items of a top-level node (empty for leaves); used to render a parent 'hub' page. */
export function getSettingsNavChildren(id: SettingsNavId): SettingsNavNode[] {
  return SETTINGS_NAV.find((node) => node.id === id)?.children ?? [];
}

/** The top-level ancestor of a nav id (e.g. 'voice-in' -> 'voice'); used for footer/section logic. */
export function getSettingsNavTopLevelGroup(id: SettingsNavId): SettingsNavId {
  switch (id) {
    case 'voice-in':
    case 'voice-out':
      return 'voice';
    case 'tools-browse':
    case 'tools-search':
      return 'tools';
    default:
      return id;
  }
}
