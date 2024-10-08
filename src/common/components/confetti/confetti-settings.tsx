'use client';

import React, { createContext, type Dispatch, type SetStateAction } from 'react';

import type { IParticlesProps } from '@tsparticles/react';
import { useMap, useStep } from 'usehooks-ts';
import { confettiConfigs } from './confetti-configs';

/**
 *
 * @param confettiSettingsArray Creates a closure around available confetti settings.
 * @returns a function that selects a random confetti setting.
 */
function setupRandomConfettiSettings(confettiSettingsArray: typeof confettiConfigs) {
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

/**
 * Hook to let folks use the confetti toolbar. Links to ConfettiContext.
 */
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

  // const { goToNextStep, goToPrevStep, reset, canGoToNextStep, canGoToPrevStep, setStep } = ...commands;

  const [step, commands] = useStep(confettiConfigs.length);
  return [activeSetting, { ...commands, random: getRandomConfig }] as const;
}
