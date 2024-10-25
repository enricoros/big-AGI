import type React from 'react';

import type { SvgIconProps } from '@mui/joy';
import { TTSEngineKey } from './vendors.registry';

export interface ISpeechSynthesis<> {
  readonly id: TTSEngineKey;
  readonly name: string;
  readonly location: 'local' | 'cloud';

  // components
  // readonly Icon: React.FunctionComponent<SvgIconProps>;
  readonly TTSSettingsComponent?: React.ComponentType;

  /// abstraction interface ///

  hasVoices?(): boolean;
  getCapabilityInfo(): CapabilitySpeechSynthesis;
  speakText(text: string, voiceId?: string): Promise<void>;
  EXPERIMENTAL_speakTextStream(text: string, voiceId?: string): Promise<void>;
  cancel?(): Promise<void>;
  stop?(): Promise<void>;
  resume?(): Promise<void>;
}

export interface CapabilitySpeechSynthesis {
  mayWork: boolean;
  isConfiguredServerSide: boolean;
  isConfiguredClientSide: boolean;
}
