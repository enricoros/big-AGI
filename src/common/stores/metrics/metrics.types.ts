/**
 * This is a stored type - IMPORTANT: do not break.
 * In particular this is used 'as' AixWire_Particles.ChatGenerateMetrics
 */
export type DChatGenerateMetrics = {
  // T = Tokens
  TIn?: number,
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,
  TAll?: number,

  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll

  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,
};
