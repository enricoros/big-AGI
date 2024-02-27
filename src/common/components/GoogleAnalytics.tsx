export function getGA4MeasurementId(): string | null {
  return process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null;
}
