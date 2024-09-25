import React, { createContext, type Dispatch, type SetStateAction } from 'react';

import type { IParticlesProps } from '@tsparticles/react';
import { useMap, useStep } from 'usehooks-ts';
import configDefault from './config-default';
import configBottom from './config-bottom';
import configExplosiions from './config-explosions';
import configFalling from './config-falling';
import configMouse from './config-mouse';
import confettiConfigside from './config-side';
import confettiConfigsingle from './config-single';

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

/**
 *
 * @param confettiSettingsArray Creates a closure around available confetti settings.
 * @returns a function that selects a random confetti setting.
 */
export function setupRandomConfettiSettings(confettiSettingsArray: typeof confettiConfigs) {
  const length = confettiSettingsArray.length;
  function makeRandomIdx() {
    return Math.floor(Math.random() * length);
  }
  /**
   * Select a random confetti setting.
   * Requires the current index of the active setting to avoid duplicates.
   */
  return function selectRandomConfettiSetting(
    // An active index to avoid duplicates
    currentIdx: number = 0,
    // blacklist some indexes from a map.
    discardIdxs: number[] = []
  ): IParticlesProps['options'] {
    const ignoredIndexes = [currentIdx, ...discardIdxs];
    let index = makeRandomIdx();
    while (ignoredIndexes.includes(index)) {
      console.debug(`Random Confetti selected duplicate with index: ${index}. Rerolling.`);
      index = makeRandomIdx();
      console.debug(`Random Confetti Next index to test: ${index}.`);
    }
    if (confettiSettingsArray[index]) {
      console.debug(
        `Random Confetti selected index: ${index}. Name: ${confettiSettingsArray[index][0]}.`
      );
      return confettiSettingsArray[index][1];
    }
  };
}
export type ConfettiConfigActions = UseStepActions & { random: () => IParticlesProps['options'] };

export function useConfettiSettings(allConfigs = confettiConfigs) {
  /**
   * Safety and types for the Map of different Confetti Setting Options
   */
  const [allSettings, actions] = useMap(new Map(allConfigs));
  const getRandomConfig = setupRandomConfettiSettings(allConfigs);

  /**
   * The user's current setting. Defaults to 'default'.
   */
  const [activeSetting, setActiveSetting] = React.useState(allSettings.get('default' as const)!);

  const [step, commands] = useStep(confettiConfigs.length);
  return [activeSetting, { ...commands, random: getRandomConfig }] as const;
}

export const ConfettiContext = createContext(confettiConfigs);
export const ConfettiProvider = ConfettiContext.Provider;
