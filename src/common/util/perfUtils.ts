type StopMeasureInterval = () => void;

export function perfMeasureInterval(measureName: string): StopMeasureInterval {
  performance.mark?.(measureName + '-start');
  return () => {
    performance.mark?.(measureName + '-end');
    performance.measure?.(measureName, measureName + '-start', measureName + '-end');
  };
}