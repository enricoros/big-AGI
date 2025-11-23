/**
 * Council voting prompts - 1:1 match with llm-council
 * Source: https://github.com/karpathy/llm-council
 */

/**
 * Ranking prompt - used by each model to rank all responses
 * Exact match with llm-council's peer review prompt
 */
export function createCouncilRankingPrompt(userQuery: string, responses: Array<{ label: string; content: string }>): string {
  const responsesText = responses
    .map(({ label, content }) => `${label}:\n${content}`)
    .join('\n\n');

  return `You are evaluating different responses to the following question:

Question: ${userQuery}

Here are the responses from different models (anonymized):

${responsesText}

Your task:
1. First, evaluate each response individually. For each response, explain what it does well and what it does poorly.
2. Then, at the very end of your response, provide a final ranking.

IMPORTANT: Your final ranking MUST be formatted EXACTLY as follows:
- Start with the line "FINAL RANKING:" (all caps, with colon)
- Then list the responses from best to worst as a numbered list
- Each line should be: number, period, space, then ONLY the response label (e.g., "1. Response A")
- Do not add any other text or explanations in the ranking section

Example format:
FINAL RANKING:
1. Response B
2. Response A
3. Response D
4. Response C

Now provide your evaluation and ranking:`;
}

/**
 * Chairman synthesis prompt - combines all responses and rankings
 * Exact match with llm-council's chairman prompt
 */
export function createCouncilChairmanPrompt(
  userQuery: string,
  responses: Array<{ rayId: string; modelName: string; content: string }>,
  rankings: Array<{ rankerName: string; evaluationText: string; extractedRanking: string }>,
): string {
  // Stage 1: Individual responses with model names
  const stage1Text = responses
    .map(({ modelName, content }) => `**${modelName}:**\n${content}`)
    .join('\n\n---\n\n');

  // Stage 2: Peer rankings with full evaluations
  const stage2Text = rankings
    .map(({ rankerName, evaluationText, extractedRanking }) =>
      `**${rankerName}'s Evaluation:**\n\n${evaluationText}\n\n${extractedRanking}`)
    .join('\n\n---\n\n');

  return `You are the Chairman of an LLM Council. Multiple AI models have provided responses to a user's question, and then ranked each other's responses.

Original Question: ${userQuery}

STAGE 1 - Individual Responses:

${stage1Text}

STAGE 2 - Peer Rankings:

${stage2Text}

Your task as Chairman is to synthesize all of this information into a single, comprehensive, accurate answer to the user's original question. Consider:
- The individual responses and their insights
- The peer rankings and what they reveal about response quality
- Any patterns of agreement or disagreement

Provide a clear, well-reasoned final answer that represents the council's collective wisdom:`;
}

/**
 * Extract user query from chat history
 */
export function extractUserQuery(chatMessages: readonly { role: string; text: string }[]): string {
  // Find the last user message
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    if (chatMessages[i].role === 'user') {
      return chatMessages[i].text;
    }
  }
  return 'No user query found';
}
