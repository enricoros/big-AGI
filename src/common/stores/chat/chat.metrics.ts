/**
 * This is a stored type - IMPORTANT: do not break.
 * In particular this is used 'as' AixWire_Particles.ChatGenerateMetrics
 */
export type DChatGenerateMetrics =
  ChatGenerateTokenMetrics
  & ChatGenerateVTokenMetrics
  & ChatGenerateTimingMetrics;
  // & ChatGenerateCostsMetrics;

// ?
// type ChatGenerateCostsMetrics = {
//   $?: number,
//   $dCache?: number,
// }

export type ChatGenerateTokenMetrics = {
  // T = Tokens
  T?: number,
  TIn?: number,
  TCacheRead?: number,
  TCacheWrite?: number,
  TOut?: number,
};

type ChatGenerateVTokenMetrics = {
  // v = Tokens/s
  vTOutInner?: number,  // TOut / dtInner
  vTOutAll?: number,    // TOut / dtAll
}

type ChatGenerateTimingMetrics = {
  // dt = milliseconds
  dtStart?: number,
  dtInner?: number,
  dtAll?: number,
}
