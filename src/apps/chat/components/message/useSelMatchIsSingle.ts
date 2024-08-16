import * as React from 'react';

import { DMessageContentFragment, isTextPart } from '~/common/stores/chat/chat.fragments';

// configuration
const MIN_SEL_LENGTH = 3;





export function useSelMatchIsSingle(selText: string | null, contentFragments: DMessageContentFragment[]): boolean {
  return React.useMemo(() => {

    // Existence check
    if (!selText || selText.length < MIN_SEL_LENGTH
      || selText.includes('```') // checks that we don't include a code block start (or end) in the selection
    )
      return false;

    // Optimized check for single occurrence
    const occurrences = contentFragments.reduce((acc, fragment) => {
      // If we've already found multiple occurrences, short-circuit
      if (acc > 1) return acc;

      if (isTextPart(fragment.part)) {
        const text = fragment.part.text;
        let count = 0;
        let index = text.indexOf(selText);

        while (index !== -1) {
          count++;
          // If we've found more than one occurrence, we can stop
          if (count > 1 || acc + count > 1) return 2;
          index = text.indexOf(selText, index + 1);
        }

        return acc + count;
      }
      return acc;
    }, 0);

    return occurrences === 1;
  }, [selText, contentFragments]);
}
