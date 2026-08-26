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
 *
 * NOTE: zustand's persist middleware hydrates from storage asynchronously, so if this
 * is called before hydration completes on a cold load, it could fire once more than
 * intended. Same tradeoff as the other persisted stores in this folder (e.g.
 * store-client.ts) - acceptable here since the cost is just an extra confetti burst,
 * not a data-integrity issue.
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
