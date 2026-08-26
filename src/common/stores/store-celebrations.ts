import { create } from 'zustand/index';
import { persist } from 'zustand/middleware';


/// Store ///

interface CelebrationsStore {

  /**
   * Set of milestone keys that have already been celebrated (confetti fired),
   * so we only ever celebrate each one once per device.
   */
  celebratedMilestones: string[];

}

const useCelebrationsStore = create<CelebrationsStore>()(persist(
  (): CelebrationsStore => ({

    // initial state
    celebratedMilestones: [],

  }),
  {
    name: 'app-celebrations',
    version: 1,
  },
));


/// Milestones ///

export type CelebrationMilestone =
  | 'first-diagram-generated'
  ;

/**
 * Marks `milestone` as celebrated and returns whether this was the first time
 * (i.e. whether the caller should actually fire the confetti).
 * Safe to call every time the underlying event happens - only fires once ever.
 */
export function celebrationConsumeMilestone(milestone: CelebrationMilestone): boolean {
  const { celebratedMilestones } = useCelebrationsStore.getState();
  if (celebratedMilestones.includes(milestone))
    return false;

  useCelebrationsStore.setState({
    celebratedMilestones: [...celebratedMilestones, milestone],
  });
  return true;
}
