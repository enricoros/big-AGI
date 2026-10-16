import type { SensorOptions } from '@dnd-kit/core/dist/sensors/types';
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';


const _pointerOptions: SensorOptions = { activationConstraint: { distance: 8 } } as const;
const _keyboardOptions: SensorOptions = { coordinateGetter: sortableKeyboardCoordinates } as const;

export function useDndDefaultSensors() {
  return useSensors(
    useSensor(PointerSensor, _pointerOptions),
    useSensor(KeyboardSensor, _keyboardOptions),
  );
}