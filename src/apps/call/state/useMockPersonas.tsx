import * as React from 'react';

import { usePurposeStore } from '../../chat/components/persona-selector/store-purposes';

import { SystemPurposeData, SystemPurposeId, SystemPurposes } from '../../../data';


/**
 * This is a 'mock' persona because Soon we'll have real personas definitions
 * and stores. Until then, we just mimic a reactive system here.
 */
export interface MockPersona extends SystemPurposeData {
  personaId: SystemPurposeId,
}

export function useMockPersonas(): { personas: MockPersona[], personaIDs: SystemPurposeId[] } {
  // only react to hiddenPurposeIDs changes
  const hiddenPurposeIDs = usePurposeStore(state => state.hiddenPurposeIDs);

  // Dependency array is empty because SystemPurposes is constant
  return React.useMemo(() => {
    const personaIDs = Object.keys(SystemPurposes) as SystemPurposeId[];
    const personas = personaIDs
      .filter((key) => !hiddenPurposeIDs.includes(key))
      .map((key) => ({
        ...SystemPurposes[key as SystemPurposeId],
        personaId: key as SystemPurposeId,
      }));
    return { personas, personaIDs };
  }, [hiddenPurposeIDs]);
}