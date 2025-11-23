/**
 * Council voting execution logic
 * Orchestrates ranking, aggregation, and chairman synthesis
 */

import { createDMessageTextContent, DMessage, messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import { aixChatGenerateContent_DMessage_FromConversation } from '~/modules/aix/client/aix.client';
import { getUXLabsHighPerformance } from '~/common/stores/store-ux-labs';

import type { CouncilRanking, CouncilResults, CouncilProgress } from './beam.gather.council.types';
import { createCouncilRankingPrompt, createCouncilChairmanPrompt, extractUserQuery } from './beam.gather.council.prompts';
import { parseCouncilRanking, aggregateCouncilRankings, buildRankingMatrix, extractRankingSection } from './beam.gather.council.aggregation';

interface RayData {
  rayId: string;
  llmId: string;
  modelName: string;
  message: DMessage;
}

/**
 * Execute the full council voting process:
 * 1. Each model ranks all responses
 * 2. Aggregate rankings
 * 3. Chairman synthesizes final answer
 */
export async function executeCouncilVoting(
  chatHistory: readonly DMessage[],
  rays: RayData[],
  chairmanLlmId: string,
  abortSignal: AbortSignal,
  onProgress: (progress: CouncilProgress) => void,
): Promise<CouncilResults> {
  const totalSteps = rays.length + 1; // N rankings + 1 synthesis
  let currentStep = 0;

  try {
    // Step 1: Extract user query
    const userQuery = extractUserQuery(
      chatHistory.map(m => ({ role: m.role, text: messageFragmentsReduceText(m.fragments) }))
    );

    // Step 2: Prepare response labels and content for ranking
    const responseLabels = rays.map((_, idx) => `Response ${String.fromCharCode(65 + idx)}`); // A, B, C, ...
    const responsesForRanking = rays.map((ray, idx) => ({
      label: responseLabels[idx],
      content: messageFragmentsReduceText(ray.message.fragments),
    }));

    // Step 3: Each model ranks all responses
    onProgress({
      state: 'ranking',
      currentStep: 0,
      totalSteps,
      message: 'Starting peer rankings...',
    });

    const rankings: CouncilRanking[] = [];

    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];
      currentStep++;

      onProgress({
        state: 'ranking',
        currentStep,
        totalSteps,
        message: `${ray.modelName} evaluating responses...`,
      });

      // Build ranking prompt
      const rankingPrompt = createCouncilRankingPrompt(userQuery, responsesForRanking);

      // Create conversation for ranking
      const systemMessage = createDMessageTextContent('system', 'You are an expert evaluator analyzing AI responses.');
      const userMessage = createDMessageTextContent('user', rankingPrompt);

      // Execute ranking via AIX
      const rankingMessage = createDMessageTextContent('assistant', '');
      let evaluationText = '';

      const result = await aixChatGenerateContent_DMessage_FromConversation(
        ray.llmId, // Use the ray's own model to rank
        systemMessage,
        [userMessage],
        'beam-council-ranking',
        ray.rayId,
        { abortSignal, throttleParallelThreads: getUXLabsHighPerformance() ? 0 : 1 },
        (update, completed) => {
          if (update.fragments) {
            evaluationText = messageFragmentsReduceText(update.fragments);
          }
        },
      );

      if (result.outcome === 'aborted') {
        throw new Error('Ranking aborted');
      }
      if (result.outcome === 'errored') {
        throw new Error(`Ranking failed: ${result.errorMessage || 'Unknown error'}`);
      }

      evaluationText = messageFragmentsReduceText(result.lastDMessage.fragments);

      // Parse rankings from the evaluation
      const parsedRankings = parseCouncilRanking(evaluationText, responseLabels);

      // Map response labels back to ray IDs
      const rankingsWithIds = parsedRankings.map(({ label, position }) => {
        const rayIndex = responseLabels.indexOf(label);
        return {
          rayId: rays[rayIndex].rayId,
          position,
        };
      });

      rankings.push({
        rankerRayId: ray.rayId,
        rankerModelName: ray.modelName,
        rankings: rankingsWithIds,
        evaluationText,
        extractedRanking: extractRankingSection(evaluationText),
      });
    }

    // Step 4: Aggregate rankings
    currentStep++;
    onProgress({
      state: 'aggregating',
      currentStep,
      totalSteps,
      message: 'Calculating aggregate rankings...',
    });

    const rayModelNames = new Map(rays.map(r => [r.rayId, r.modelName]));
    const rayResponsePreviews = new Map(
      rays.map(r => [r.rayId, messageFragmentsReduceText(r.message.fragments).slice(0, 100)])
    );

    const aggregations = aggregateCouncilRankings(
      rankings,
      rays.map(r => r.rayId),
      rayModelNames,
      rayResponsePreviews,
    );

    const rankingMatrix = buildRankingMatrix(rankings);

    // Step 5: Chairman synthesis
    currentStep++;
    onProgress({
      state: 'synthesizing',
      currentStep,
      totalSteps,
      message: 'Chairman synthesizing final answer...',
    });

    const responsesForChairman = rays.map(ray => ({
      rayId: ray.rayId,
      modelName: ray.modelName,
      content: messageFragmentsReduceText(ray.message.fragments),
    }));

    const rankingsForChairman = rankings.map(r => ({
      rankerName: r.rankerModelName,
      evaluationText: r.evaluationText,
      extractedRanking: r.extractedRanking,
    }));

    const chairmanPrompt = createCouncilChairmanPrompt(userQuery, responsesForChairman, rankingsForChairman);

    const systemMessage = createDMessageTextContent('system', 'You are the Chairman of an LLM Council, tasked with synthesizing peer-ranked responses.');
    const userMessage = createDMessageTextContent('user', chairmanPrompt);

    const chairmanResult = await aixChatGenerateContent_DMessage_FromConversation(
      chairmanLlmId,
      systemMessage,
      [userMessage],
      'beam-council-chairman',
      'chairman',
      { abortSignal, throttleParallelThreads: getUXLabsHighPerformance() ? 0 : 1 },
      () => {
        // Progress updates handled via onProgress callback
      },
    );

    if (chairmanResult.outcome === 'aborted') {
      throw new Error('Chairman synthesis aborted');
    }
    if (chairmanResult.outcome === 'errored') {
      throw new Error(`Chairman synthesis failed: ${chairmanResult.errorMessage || 'Unknown error'}`);
    }

    const finalChairmanMessage = chairmanResult.lastDMessage;

    // Step 6: Complete
    onProgress({
      state: 'complete',
      currentStep: totalSteps,
      totalSteps,
      message: 'Council voting complete',
    });

    return {
      rankings,
      aggregations,
      chairmanSynthesis: finalChairmanMessage,
      rankingMatrix,
    };

  } catch (error) {
    onProgress({
      state: 'error',
      currentStep,
      totalSteps,
      message: 'Council voting failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
