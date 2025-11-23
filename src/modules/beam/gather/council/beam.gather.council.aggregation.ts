/**
 * Council ranking parsing and aggregation logic
 * Implements llm-council's ranking extraction and score calculation
 */

import type { CouncilRanking, CouncilAggregation } from './beam.gather.council.types';

/**
 * Parse "FINAL RANKING:" section from evaluation text
 * Matches llm-council's regex-based extraction
 */
export function parseCouncilRanking(evaluationText: string, responseLabels: string[]): Array<{ label: string; position: number }> {
  const rankings: Array<{ label: string; position: number }> = [];

  // Find the "FINAL RANKING:" section
  const finalRankingMatch = evaluationText.match(/FINAL RANKING:\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (!finalRankingMatch) {
    console.warn('Could not find "FINAL RANKING:" section in evaluation');
    return rankings;
  }

  const rankingSection = finalRankingMatch[1];

  // Parse numbered list (e.g., "1. Response A", "2. Response B", etc.)
  const lines = rankingSection.split('\n').filter(line => line.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match pattern: "1. Response A" or "1) Response A" or "1 - Response A"
    const match = line.match(/^(\d+)[.)\-\s]+(.+)$/);
    if (!match) continue;

    const position = parseInt(match[1], 10);
    const labelText = match[2].trim();

    // Find which response label this matches
    const matchedLabel = responseLabels.find(label =>
      labelText.toLowerCase().includes(label.toLowerCase())
    );

    if (matchedLabel) {
      rankings.push({ label: matchedLabel, position });
    }
  }

  return rankings;
}

/**
 * Calculate standard deviation of rankings
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(variance);
}

/**
 * Aggregate rankings across all rankers
 * Implements llm-council's averaging and "street cred" calculation
 */
export function aggregateCouncilRankings(
  rankings: CouncilRanking[],
  rayIds: string[],
  rayModelNames: Map<string, string>,
  rayResponsePreviews: Map<string, string>,
): CouncilAggregation[] {
  const aggregations: CouncilAggregation[] = [];

  for (const rayId of rayIds) {
    const positions: number[] = [];

    // Collect all positions this ray received from rankers
    for (const ranking of rankings) {
      const rankEntry = ranking.rankings.find(r => r.rayId === rayId);
      if (rankEntry) {
        positions.push(rankEntry.position);
      }
    }

    // Calculate average rank
    const averageRank = positions.length > 0
      ? positions.reduce((sum, pos) => sum + pos, 0) / positions.length
      : 999; // No votes = worst possible

    // Calculate standard deviation (controversy metric)
    const standardDeviation = calculateStandardDeviation(positions);

    aggregations.push({
      rayId,
      modelName: rayModelNames.get(rayId) || 'Unknown',
      averageRank,
      voteCount: positions.length,
      standardDeviation,
      positions,
      responsePreview: rayResponsePreviews.get(rayId) || '',
    });
  }

  // Sort by average rank (ascending - lower is better)
  aggregations.sort((a, b) => a.averageRank - b.averageRank);

  return aggregations;
}

/**
 * Build ranking matrix: ranker -> ranked -> position
 */
export function buildRankingMatrix(rankings: CouncilRanking[]): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const ranking of rankings) {
    const rankerMap = new Map<string, number>();

    for (const { rayId, position } of ranking.rankings) {
      rankerMap.set(rayId, position);
    }

    matrix.set(ranking.rankerRayId, rankerMap);
  }

  return matrix;
}

/**
 * Extract the "FINAL RANKING:" section as formatted text
 */
export function extractRankingSection(evaluationText: string): string {
  const match = evaluationText.match(/FINAL RANKING:\s*\n([\s\S]*?)(?:\n\n|$)/i);
  return match ? `FINAL RANKING:\n${match[1]}` : 'No ranking found';
}
