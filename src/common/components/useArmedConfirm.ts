import * as React from 'react';


const ARMED_TIMEOUT_MS = 5000;


/**
 * Two-step confirm: the first click arms, the second confirms. Shift-click confirms at once.
 * Disarms itself after 5s, so a lingering armed target can't catch a later click.
 * Both clicks stop propagation: these controls usually sit inside clickable rows.
 */
export function useArmedConfirm(onConfirm: (event: React.MouseEvent) => void) {

  const [armed, setArmed] = React.useState(false);

  // [effect] auto-disarm after timeout
  React.useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), ARMED_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [armed]);

  const confirm = React.useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setArmed(false);
    onConfirm(event);
  }, [onConfirm]);

  const toggle = React.useCallback((event: React.MouseEvent) => {
    if (!armed && event.shiftKey) return confirm(event);
    event.stopPropagation();
    setArmed(!armed);
  }, [armed, confirm]);

  const disarm = React.useCallback(() => setArmed(false), []);

  return { armed, toggle, confirm, disarm };
}
