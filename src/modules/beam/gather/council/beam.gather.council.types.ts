/**
 * Council voting types for Beam Gather
 * Implements llm-council's peer ranking mechanism
 */

import type { DMessage } from '~/common/stores/chat/chat.message';

/**
 * Individual ranking from one model (ranker) evaluating all responses
 */
export interface CouncilRanking {
  rankerRayId: string;
  rankerModelName: string;
  rankings: Array<{
    rayId: string;
    position: number; // 1 = best, N = worst
  }>;
  evaluationText: string; // Full evaluation with reasoning
  extractedRanking: string; // Parsed "FINAL RANKING:" section
}

/**
 * Aggregated ranking results for one response
 */
export interface CouncilAggregation {
  rayId: string;
  modelName: string;
  averageRank: number; // Lower is better (1.0 = best possible)
  voteCount: number;
  standardDeviation: number; // Higher = more controversial
  positions: number[]; // All rank positions received
  responsePreview: string; // First ~100 chars of response
}

/**
 * Complete council voting results
 */
export interface CouncilResults {
  rankings: CouncilRanking[];
  aggregations: CouncilAggregation[];
  chairmanSynthesis?: Partial<DMessage> & { fragments: DMessage['fragments'] };
  rankingMatrix: Map<string, Map<string, number>>; // ranker -> ranked -> position
}

/**
 * Council voting state
 */
export type CouncilState = 'idle' | 'ranking' | 'aggregating' | 'synthesizing' | 'complete' | 'error';

/**
 * Council voting progress
 */
export interface CouncilProgress {
  state: CouncilState;
  currentStep: number;
  totalSteps: number;
  message: string;
  error?: string;
}
