import configDefault from './config-default';
import configBottom from './config-bottom';
import configExplosiions from './config-explosions';
import configFalling from './config-falling';
import configMouse from './config-mouse';
import confettiConfigside from './config-side';
import confettiConfigsingle from './config-single';
import type { IParticlesProps } from '@tsparticles/react';
import React, { type Dispatch, type SetStateAction } from 'react';

export type ConfettiSettingName =
  | 'default'
  | 'bottom'
  | 'explosions'
  | 'falling'
  | 'mouse'
  | 'side'
  | 'single';
export type ConfettiProps = IParticlesProps['options'];

/**
 * Nested array of confetti settings for consumption by an iterable.
 *
 * Contains default settings for different confetti configurations.
 */
export const confettiConfigs: readonly [ConfettiSettingName, NonNullable<ConfettiProps>][] = [
  ['default', configDefault],
  ['bottom', configBottom],
  ['explosions', configExplosiions],
  ['falling', configFalling],
  ['mouse', configMouse],
  ['side', confettiConfigside],
  ['single', confettiConfigsingle],
] as const;

export type ConfettiSetting = {
  name: ConfettiSettingName;
  settings: IParticlesProps['options'];
};

export type UseStepActions = {
  /** Go to the next step in the process. */
  goToNextStep: () => void;
  /** Go to the previous step in the process. */
  goToPrevStep: () => void;
  /** Reset the step to the initial step. */
  reset: () => void;
  /** Check if the next step is available. */
  canGoToNextStep: boolean;
  /** Check if the previous step is available. */
  canGoToPrevStep: boolean;
  /** Set the current step to a specific value. */
  setStep: Dispatch<SetStateAction<number>>;
};

export type ConfettiConfigActions = UseStepActions & { random: () => IParticlesProps['options'] };
