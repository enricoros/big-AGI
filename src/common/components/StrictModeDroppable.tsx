import * as React from 'react';
import { Droppable, type DroppableProps } from 'react-beautiful-dnd';


/**
 * A wrapper around React-Beautiful-Dnd `Droppable` that skips the first render,
 */
export function StrictModeDroppable({ children, ...props }: DroppableProps) {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const animation = requestAnimationFrame(() => setEnabled(true));

    return () => {
      cancelAnimationFrame(animation);
      setEnabled(false);
    };
  }, []);

  return enabled ? <Droppable {...props}>{children}</Droppable> : null;
}
