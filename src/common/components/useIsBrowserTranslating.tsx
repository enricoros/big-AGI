import * as React from 'react';

import { Alert, IconButton } from '@mui/joy';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import { useUICounter } from '~/common/state/store-ui';


export function useIsBrowserTranslating(timeout: number = 5000): boolean {
  // state
  const [isTranslating, setIsTranslating] = React.useState(false);

  React.useEffect(() => {

    const htmlElementMutationCallback: MutationCallback = (mutationsList, observer) => {
      for (const mutation of mutationsList) {
        // only look for class attribute changes
        if (mutation.type !== 'attributes' || mutation.attributeName !== 'class')
          continue;

        const target = mutation.target as HTMLElement;
        const isTranslatingChrome = target.classList?.contains('translated-ltr') || target.classList?.contains('translated-rtl');
        setIsTranslating(isTranslatingChrome);
        break;
      }
    };

    // Start observing the <html> element for only attribute changes to 'class'
    const observer = new MutationObserver(htmlElementMutationCallback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return isTranslating;
}

export function useBrowserTranslationWarning() {

  // state
  const [hideWarning, setHideWarning] = React.useState(false);

  // external state
  const isTranslating = useIsBrowserTranslating();
  const { novel: lessThanFive, touch } = useUICounter('acknowledge-translation-warning', 5);

  const showWarning = isTranslating && !hideWarning && lessThanFive;

  return React.useMemo(() => showWarning ? (
    <Alert
      variant='outlined' color='warning'
      startDecorator={<WarningRoundedIcon />}
      endDecorator={
        <IconButton color='warning'>
          <CloseRoundedIcon onClick={() => {
            setHideWarning(true);
            touch();
          }} />
        </IconButton>
      }
    >
      This page is being translated by your browser. It is recommended to turn OFF translation as it may cause issues,
      such as &quot;a client-side exception has occurred&quot;.
    </Alert>
  ) : null, [showWarning, touch]);
}