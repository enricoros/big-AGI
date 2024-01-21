import * as React from 'react';

import { SystemPurposeData, SystemPurposeId, SystemPurposes } from '../../../data';


/**
 * This is a 'mock' persona because Soon we'll have real personas definitions
 * and stores. Until then, we just mimic a reactive system here.
 */
export interface MockPersona extends SystemPurposeData {
  personaId: SystemPurposeId,
}

export function useMockPersonas(): { personas: MockPersona[], personaIDs: SystemPurposeId[] } {
  // Dependency array is empty because SystemPurposes is constant
  return React.useMemo(() => {
    const personaIDs = Object.keys(SystemPurposes) as SystemPurposeId[];
    const personas = personaIDs.map((key) => ({
      ...SystemPurposes[key as SystemPurposeId],
      personaId: key as SystemPurposeId,
    }));
    return { personas, personaIDs };
  }, []);
}