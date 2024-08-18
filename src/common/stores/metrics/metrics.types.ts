import { DModelPricing } from '~/common/stores/llms/llms.pricing';

/**
 * This is a stored type - IMPORTANT: do not break.
 * In particular this is used 'as' AixWire_Particles.ChatGenerateMetrics
 */
export type DChatGenerateMetrics = {
  // T = Tokens
  T?: number,
  TIn?: number,
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,

  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll

  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,
};
