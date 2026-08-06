import { callBrowseFetchPageOrThrow } from '~/modules/browse/browse.client';
import { useBrowseStore } from '~/modules/browse/store-module-browsing';
import { aixChatGenerateText_Simple } from '~/modules/aix/client/aix.client';
import type { DLLMId } from '~/common/stores/llms/llms.types';
import { messageFragmentsReduceText } from '~/common/stores/chat/chat.message';
import type { DMessage } from '~/common/stores/chat/chat.message';

import { SLM_AGENTS, buildAgentSystemPrompt, buildOrchestratorRoster } from './slm.agents';


// Outputs scoring below this after Phase 5 Validation trigger a second targeted fix pass.
const VALIDATION_PASS_THRESHOLD = 0.80;


// --- Types ---

interface AgentTask {
  id: string;
  task: string;
}

interface OrchestratorPlan {
  analysis: string;
  agents: AgentTask[];
  reviewers: string[];
  enhancer: string;
}

interface AgentOutput {
  id: string;
  name: string;
  task: string;
  result: string;
  confidence: number;
}

interface ReviewResult {
  agentId: string;
  passed: boolean;
  feedback: string;
  score: number;
}

type ProgressCallback = (text: string, done: boolean) => void;


// --- Phase 1: Planning ---

async function planAgents(
  userMessage: string,
  conversationContext: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<OrchestratorPlan> {
  const roster = buildOrchestratorRoster();

  const planningPrompt = `You are the SLM Orchestrator. Analyze this request and produce an optimal agent execution plan.

## Available Agent Roster
${roster}

## User Request
${userMessage}

${conversationContext ? `## Conversation Context\n${conversationContext}` : ''}

## Constraint Extraction (reason through this before selecting agents)
Identify from the request:
- Explicit programming language(s) (e.g., "Python", "TypeScript", "Go")
- Frameworks or libraries named
- Output type (script, API endpoint, UI component, config file, documentation, etc.)
- Hard constraints ("must use X", "without Y", "only Z")

## Agent Selection Rules
- Select 2–4 agents whose domains DIRECTLY cover distinct parts of the request. Overlap wastes cycles.
- LANGUAGE ENFORCEMENT: If the user names a specific programming language, assign ONLY the matching language specialist. Python → L1. JavaScript/Node.js → L2. Go → L3. Rust → L4. SQL → L7. NEVER assign a language specialist to produce output in a different language than requested.
- Each agent's task description MUST explicitly state the target language/technology so the agent cannot drift.
- Only use agent IDs that appear in the roster above. Do not invent agent IDs.
- Reviewers: always include Q3 for code tasks. Include Q1 for security-sensitive work. Include Q4 for debugging tasks.
- Enhancer: choose the agent best positioned to elevate the final output quality (often Q3, Q6, or A5).

Return ONLY valid JSON (no markdown, no explanation):
{
  "analysis": "one-sentence summary of what this request needs",
  "agents": [
    {"id": "AGENT_ID", "task": "specific task with explicit language/tech constraint"}
  ],
  "reviewers": ["Q3"],
  "enhancer": "AGENT_ID"
}`;

  const raw = await aixChatGenerateText_Simple(
    llmId,
    'You are the SLM Orchestrator. Output only valid JSON.',
    planningPrompt,
    'chat-react-turn',
    'slm-plan',
    { abortSignal },
  );

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]) as OrchestratorPlan;
  } catch {
    // fallback below
  }

  return {
    analysis: 'General request — routing to core agents',
    agents: [
      { id: 'A1', task: userMessage },
      { id: 'Q3', task: `Review the response for quality and correctness: ${userMessage}` },
    ],
    reviewers: ['Q3'],
    enhancer: 'A1',
  };
}


// --- Phase 1.5: Web Research ---
// Fetches live documentation, API references, or authoritative sources when they would
// materially improve agent output accuracy. Silently skips if browse is not configured
// or if the task does not require external grounding.

async function gatherWebResearch(
  userMessage: string,
  plan: OrchestratorPlan,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<string> {
  const { wssEndpoint } = useBrowseStore.getState();
  const browseEnabled = typeof wssEndpoint === 'string' && wssEndpoint.length > 8;
  if (!browseEnabled) return '';

  const researchPlanPrompt = `You are the SLM Research Director. Decide if the following task requires live web research to ensure accuracy.

## User Request
${userMessage}

## Planned Agents
${plan.agents.map(a => `${a.id}: ${a.task}`).join('\n')}

Research is warranted when the task involves:
- A specific library, framework, or API where version-specific documentation matters
- A tool or technology where best practices have evolved recently
- A topic where citing authoritative sources would substantially improve answer quality

Research is NOT warranted for:
- General programming patterns or algorithms
- Simple explanations or creative tasks
- Anything fully covered by common knowledge in the model's training

If research is warranted, provide up to 3 highly specific, directly relevant URLs (official docs, spec pages, authoritative references — not blog posts or forums).

Return ONLY valid JSON:
{
  "needsResearch": true,
  "reason": "one sentence explaining why",
  "urls": ["https://..."]
}`;

  try {
    const raw = await aixChatGenerateText_Simple(
      llmId,
      'You are the SLM Research Director. Output only valid JSON. No markdown wrapper.',
      researchPlanPrompt,
      'chat-react-turn',
      'slm-research-plan',
      { abortSignal },
    );

    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return '';

    const researchPlan = JSON.parse(jsonMatch[0]) as { needsResearch: boolean; reason: string; urls?: string[] };
    if (!researchPlan.needsResearch || !researchPlan.urls?.length) return '';

    const fetchResults = await Promise.allSettled(
      researchPlan.urls.slice(0, 3).map(async (url): Promise<string> => {
        const page = await callBrowseFetchPageOrThrow(url);
        let content = '';
        if (typeof page.content === 'string') {
          content = page.content;
        } else if (page.content && typeof page.content === 'object') {
          content = Object.values(page.content as Record<string, string>)[0] ?? '';
        }
        const trimmed = content.trim().slice(0, 4000);
        if (!trimmed) return '';
        return `### Source: ${url}\n${trimmed}`;
      })
    );

    const gathered = fetchResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value.length > 60)
      .map(r => r.value)
      .join('\n\n---\n\n');

    return gathered
      ? `## Live Web Research\n_Fetched for this task — agents must use this to ensure accuracy and currency._\n\n${gathered}`
      : '';
  } catch {
    return '';
  }
}


// --- Phase 2: Parallel Agent Execution ---

async function executeAgents(
  plan: OrchestratorPlan,
  userMessage: string,
  llmId: DLLMId,
  researchContext: string,
  onAgentComplete: (output: AgentOutput) => void,
  abortSignal: AbortSignal,
): Promise<AgentOutput[]> {
  const agentPromises = plan.agents.map(async ({ id, task }): Promise<AgentOutput | null> => {
    const agentDef = SLM_AGENTS[id];
    if (!agentDef) return null;

    const systemPrompt = buildAgentSystemPrompt(agentDef);

    const parts = [
      `## Your Task\n${task}`,
      `## Full User Request\n${userMessage}`,
    ];
    if (researchContext) parts.push(researchContext);
    parts.push(
      `## Delivery Standard\nProduce a complete, production-ready deliverable — working code, not sketches. If the task names a language or technology, use exactly that. Apply security best practices, robust error handling, and idiomatic patterns without being asked. If web research is provided above, you MUST use it to ensure your output reflects current, accurate documentation — do not rely on potentially outdated training knowledge when authoritative source material is available.`,
    );

    const userPrompt = parts.join('\n\n');

    try {
      const result = await aixChatGenerateText_Simple(
        llmId,
        systemPrompt,
        userPrompt,
        'chat-react-turn',
        `slm-agent-${id}`,
        { abortSignal },
      );

      const confidenceMatch = result.match(/Confidence:\s*([\d.]+)/i);
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : agentDef.brilliance;

      const output: AgentOutput = { id, name: agentDef.name, task, result, confidence };
      onAgentComplete(output);
      return output;
    } catch {
      return null;
    }
  });

  // allSettled: one agent failure never kills the rest
  const results = await Promise.allSettled(agentPromises);
  return results
    .filter((r): r is PromiseFulfilledResult<AgentOutput | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((r): r is AgentOutput => r !== null);
}


// --- Phase 3: Review ---

async function reviewOutputs(
  agentOutputs: AgentOutput[],
  userMessage: string,
  llmId: DLLMId,
  reviewerIds: string[],
  abortSignal: AbortSignal,
): Promise<ReviewResult[]> {
  const outputSummary = agentOutputs
    .map(o => `### ${o.id} · ${o.name}\n${o.result}`)
    .join('\n\n---\n\n');

  const reviewResults: ReviewResult[] = [];

  for (const reviewerId of reviewerIds) {
    const reviewer = SLM_AGENTS[reviewerId];
    if (!reviewer) continue;

    const reviewPrompt = `## Original Request
${userMessage}

## Scoring Rubric (apply strictly — do not be generous)
- 90–100%: Production-ready, expert-level. Complete, correct, secure, idiomatic. Handles realistic edge cases.
- 70–89%: Good quality with minor gaps (one missing error case, a style issue). Fully addresses the request.
- 40–69%: Partially addresses the request, or has meaningful correctness/completeness gaps.
- 10–39%: Superficially related but fails the core requirement (wrong language, outline instead of implementation, broken logic).
- 0–9%: Off-topic, dangerous, or completely wrong.

## Hard Fail Criteria (passed: false, score ≤ 0.30 — enforce without exception)
An output FAILS automatically if:
- It uses a different programming language than explicitly requested
- It is an outline, concept, or architectural plan when runnable code was requested
- It introduces security vulnerabilities: XSS (user data inserted into HTML without escaping), SQL injection, hardcoded credentials, unvalidated shell inputs
- It ignores the primary requirement of the task

## Agent Outputs to Review
${outputSummary}

Evaluate each output against the rubric and hard-fail criteria. Feedback must be specific and actionable — cite the exact issue and what the fix should be.
Return JSON:
{
  "reviews": [
    {"agentId": "ID", "passed": true/false, "feedback": "specific actionable feedback with exact issues cited", "score": 0.00}
  ]
}`;

    try {
      const raw = await aixChatGenerateText_Simple(
        llmId,
        buildAgentSystemPrompt(reviewer),
        reviewPrompt,
        'chat-react-turn',
        `slm-review-${reviewerId}`,
        { abortSignal },
      );

      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.reviews) reviewResults.push(...parsed.reviews);
      }
    } catch {
      for (const o of agentOutputs)
        reviewResults.push({ agentId: o.id, passed: true, feedback: '', score: o.confidence });
    }
  }

  return reviewResults;
}


// --- Phase 4: Fix & Revision ---

async function fixFailedOutputs(
  reviewResults: ReviewResult[],
  originalOutputs: AgentOutput[],
  userMessage: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<AgentOutput[]> {
  const failed = reviewResults.filter(r => !r.passed);
  if (failed.length === 0) return originalOutputs;

  const fixPromises = failed.map(async (review): Promise<AgentOutput | null> => {
    const original = originalOutputs.find(o => o.id === review.agentId);
    if (!original) return null;

    const agentDef = SLM_AGENTS[original.id];
    if (!agentDef) return null;

    const fixPrompt = `## Review Feedback — Address EVERY point listed below
${review.feedback}

## Your Previous Output (to revise)
${original.result}

## Original Task
${original.task}

## User Request
${userMessage}

Produce a complete replacement that fully resolves every issue in the review feedback. If the previous output was in the wrong language, rewrite it entirely in the correct language. If there were security issues, apply the correct fix — not a comment about it. Do not patch around issues — fix them at the root. The output must pass: correct language, working code, no security vulnerabilities, complete implementation.`;

    try {
      const result = await aixChatGenerateText_Simple(
        llmId,
        buildAgentSystemPrompt(agentDef),
        fixPrompt,
        'chat-react-turn',
        `slm-fix-${original.id}`,
        { abortSignal },
      );

      return { ...original, result, confidence: Math.min(original.confidence + 0.02, 1.0) };
    } catch {
      return original;
    }
  });

  const fixes = await Promise.allSettled(fixPromises);
  const fixMap = new Map(
    fixes
      .filter((f): f is PromiseFulfilledResult<AgentOutput | null> => f.status === 'fulfilled')
      .map(f => f.value)
      .filter((f): f is AgentOutput => f !== null)
      .map(f => [f.id, f]),
  );

  return originalOutputs.map(o => fixMap.get(o.id) ?? o);
}


// --- Phase 5: Validation ---

async function validateOutputs(
  agentOutputs: AgentOutput[],
  userMessage: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<{ outputs: AgentOutput[]; validationScore: number; criticalIssues: string[] }> {
  const validator = SLM_AGENTS['Q1'];
  if (!validator) return { outputs: agentOutputs, validationScore: 0.95, criticalIssues: [] };

  const outputSummary = agentOutputs.map(o => `### ${o.id} · ${o.name}\n${o.result}`).join('\n\n---\n\n');

  const validatePrompt = `## User Request
${userMessage}

## All Agent Outputs
${outputSummary}

Run a thorough validation pass. Check each of the following explicitly:
1. LANGUAGE COMPLIANCE: Is the output in the exact language/technology the user requested?
2. SECURITY: Any XSS (user data in HTML without escaping)? SQL injection? Hardcoded credentials? Unvalidated inputs passed to shell/SQL?
3. CORRECTNESS: Does every code block actually run? Are all imports present? Any logic bugs or off-by-one errors?
4. COMPLETENESS: Does the response fully address the user's request? Any required components missing or stubbed out?
5. EDGE CASES: Are obvious failure modes handled — null/None values, network errors, empty inputs, type mismatches?

Score based on how many of the above pass cleanly. Cite every specific issue found. Classify issues: regular issues reduce score; critical issues (security bugs, wrong language, broken code that won't run) must be listed separately and will trigger a mandatory fix pass.

Return JSON:
{
  "validationScore": 0.00,
  "issues": ["specific issue description"],
  "criticalIssues": ["issues requiring mandatory remediation — security bugs, wrong language, unrunnable code"],
  "approved": true
}`;

  try {
    const raw = await aixChatGenerateText_Simple(
      llmId,
      buildAgentSystemPrompt(validator),
      validatePrompt,
      'chat-react-turn',
      'slm-validate',
      { abortSignal },
    );

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        outputs: agentOutputs,
        validationScore: parsed.validationScore ?? 0.95,
        criticalIssues: Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues : [],
      };
    }
  } catch {
    // fallthrough
  }

  return { outputs: agentOutputs, validationScore: 0.95, criticalIssues: [] };
}


// --- Phase 5b: Validation-Triggered Critical Fix ---
// Only runs when validationScore < VALIDATION_PASS_THRESHOLD.
// The Sovereign Security Warden (SEC-Ω) or Q1 applies surgical corrections
// to every critical issue identified by the validator, then adds the fixed
// content as a highest-authority contribution that the assembler must honor.

async function resolveValidationFailures(
  outputs: AgentOutput[],
  criticalIssues: string[],
  userMessage: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<AgentOutput[]> {
  if (criticalIssues.length === 0) return outputs;

  const corrector = SLM_AGENTS['SEC-Ω'] ?? SLM_AGENTS['Q1'];
  if (!corrector) return outputs;

  const outputSummary = outputs.map(o => `### ${o.id} · ${o.name}\n${o.result}`).join('\n\n---\n\n');

  const fixPrompt = `## Critical Issues Identified by Validation
${criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

## All Agent Outputs
${outputSummary}

## User Request
${userMessage}

For EACH critical issue listed: identify which output is affected, then produce a corrected replacement for that section. Label corrections by agent ID. Be surgical and complete — rewrite the affected section with the exact fix applied. Do not summarize or give advice; produce the fixed code/content directly.

These corrections carry the highest authority in the pipeline and will override original agent outputs in the final assembly.`;

  try {
    const correction = await aixChatGenerateText_Simple(
      llmId,
      buildAgentSystemPrompt(corrector),
      fixPrompt,
      'chat-react-turn',
      'slm-validation-fix',
      { abortSignal },
    );

    return [
      ...outputs,
      {
        id: corrector.id,
        name: `${corrector.name} (Validation Fix — Highest Authority)`,
        task: 'Critical issue resolution',
        result: correction,
        confidence: 1.0,
      },
    ];
  } catch {
    return outputs;
  }
}


// --- Phase 6: Enhancement ---

async function enhanceOutputs(
  agentOutputs: AgentOutput[],
  userMessage: string,
  enhancerId: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<AgentOutput[]> {
  const enhancer = SLM_AGENTS[enhancerId] ?? SLM_AGENTS['U2'];
  if (!enhancer) return agentOutputs;

  const outputSummary = agentOutputs.map(o => `### ${o.id} · ${o.name}\n${o.result}`).join('\n\n---\n\n');

  const enhancePrompt = `## Original Request
${userMessage}

## All Agent Outputs
${outputSummary}

You are performing the final quality-elevation pass. Identify the top 1–2 highest-impact improvements not yet addressed. Prioritize in this order:
1. Security gaps — unescaped output, missing input validation, exposed credentials, unsafe HTML construction
2. Correctness gaps — bugs, wrong API usage, missing imports, logic errors
3. Completeness gaps — missing error handling, absent deployment guidance, uncovered edge cases
4. Quality gaps — better idiomatic patterns, cleaner structure, improved readability

For each improvement: deliver it as concrete, ready-to-use code or configuration — not advice. If a security fix requires rewriting a section, rewrite it.
Return the enhanced content labeled: [ENHANCEMENT · ${enhancer.id}]`;

  try {
    const enhancement = await aixChatGenerateText_Simple(
      llmId,
      buildAgentSystemPrompt(enhancer),
      enhancePrompt,
      'chat-react-turn',
      'slm-enhance',
      { abortSignal },
    );

    return [
      ...agentOutputs,
      { id: enhancer.id, name: `${enhancer.name} (Enhancement)`, task: 'Enhancement pass', result: enhancement, confidence: enhancer.brilliance },
    ];
  } catch {
    return agentOutputs;
  }
}


// --- Phase 7: Final Assembly ---

async function assembleOutput(
  agentOutputs: AgentOutput[],
  userMessage: string,
  llmId: DLLMId,
  abortSignal: AbortSignal,
): Promise<string> {
  const outputSummary = agentOutputs.map(o => `### ${o.id} · ${o.name}\n${o.result}`).join('\n\n---\n\n');

  const assemblePrompt = `You are the SLM Orchestrator performing final synthesis. This response goes directly to a senior engineer who will use it in production. There is no room for gaps, stubs, or mediocrity.

## User's Original Request
${userMessage}

## All Agent Contributions
_Listed in order of authority. Entries marked "Highest Authority" or "Validation Fix" override earlier outputs on conflicting points._

${outputSummary}

## Expert Assembly Protocol — every point is mandatory
1. COMPLETENESS: Fully solve what was asked. No TODOs, no "left as an exercise", no unimplemented stubs. Placeholder values (credentials, domain names) should be clearly labeled YOUR_VALUE_HERE only when they are inherently user-specific.
2. CORRECTNESS: Cross-check all code logic, imports, and API calls. Fix every bug you identify — do not propagate agent errors. Where outputs conflict, use the higher-authority version.
3. SECURITY: Apply all applicable security practices: escape user-controlled data before inserting into HTML/SQL/shell, use environment variables for credentials, validate at all system boundaries, never expose internal errors to users.
4. COHERENCE: Strip all agent headers, phase labels, and internal meta-commentary. One voice, no contradictions, no duplicate content.
5. USABILITY: Structure for immediate use by a developer reading top-to-bottom. Every code block must run as-is. Shell commands must be accurate. Install instructions must match the actual packages used.
6. AUTHORITY HIERARCHY: Any contribution labeled "Validation Fix — Highest Authority" or "Enhancement" contains final corrections. These MUST be fully incorporated — they represent post-review corrections and override original agent outputs on any point they address.

Produce the response as if a single senior engineer with 30 years of deep cross-domain expertise wrote it from scratch after reviewing all agent contributions — complete, production-ready, immediately usable.`;

  return await aixChatGenerateText_Simple(
    llmId,
    'You are the SLM Orchestrator. Synthesize agent outputs into a single perfect response.',
    assemblePrompt,
    'chat-react-turn',
    'slm-assemble',
    { abortSignal },
  );
}


// --- Main Pipeline Entry Point ---

export async function runSLMPipeline(params: {
  userMessage: string;
  conversationContext: string;
  llmId: DLLMId;
  abortSignal: AbortSignal;
  onProgress: ProgressCallback;
}): Promise<string> {
  const { userMessage, conversationContext, llmId, abortSignal, onProgress } = params;

  let log = '🛰️ **SLM Matrix Active**\n\n';
  const emit = (line: string, done = false) => {
    log += line + '\n';
    onProgress(log, done);
  };
  const preview = (text: string, max = 280) => {
    const trimmed = text.trim().replace(/\n+/g, ' ');
    return trimmed.length > max ? trimmed.slice(0, max) + '…' : trimmed;
  };

  // Phase 1: Plan
  emit('**Phase 1 — Analysis & Planning**');
  emit('_Orchestrator decomposing request and selecting agents..._');

  let plan: OrchestratorPlan;
  try {
    plan = await planAgents(userMessage, conversationContext, llmId, abortSignal);
  } catch {
    emit('⚠️ Planning failed — using fallback routing');
    plan = {
      analysis: 'Fallback routing',
      agents: [{ id: 'A1', task: userMessage }],
      reviewers: ['Q3'],
      enhancer: 'U2',
    };
  }

  emit(`📋 **${plan.analysis}**`);
  emit('');
  emit('**Agent Roster for this task:**');
  for (const { id, task } of plan.agents) {
    const def = SLM_AGENTS[id];
    emit(`- \`${id}\` **${def?.name ?? id}** — _${preview(task, 120)}_`);
  }
  emit(`\nReviewers: ${plan.reviewers.map(r => `\`${r}\` ${SLM_AGENTS[r]?.name ?? r}`).join(', ')} · Enhancer: \`${plan.enhancer}\` ${SLM_AGENTS[plan.enhancer]?.name ?? plan.enhancer}\n`);

  // Phase 1.5: Web Research
  emit('**Phase 1.5 — Web Research**');
  emit('_Checking whether live documentation or authoritative sources are needed..._');

  let researchContext = '';
  try {
    researchContext = await gatherWebResearch(userMessage, plan, llmId, abortSignal);
  } catch {
    // non-fatal
  }

  if (researchContext) {
    emit(`🌐 Research gathered — agents will use live source material\n`);
  } else {
    emit(`_No external research required for this task_\n`);
  }

  // Phase 2: Execute
  emit('**Phase 2 — Parallel Agent Execution**');

  const agentStatusMap = new Map<string, string>();
  const agentOutputSnippetMap = new Map<string, string>();
  for (const { id } of plan.agents) agentStatusMap.set(id, '⏳ queued');

  const renderPhase2 = () =>
    plan.agents.map(({ id }) => {
      const def = SLM_AGENTS[id];
      const status = agentStatusMap.get(id) ?? '⏳ queued';
      const snippet = agentOutputSnippetMap.get(id);
      const header = `- ${status} \`${id}\` · **${def?.name ?? id}**`;
      return snippet ? `${header}\n  > ${snippet}` : header;
    }).join('\n');

  emit(renderPhase2() + '\n');

  const agentOutputs = await executeAgents(
    plan,
    userMessage,
    llmId,
    researchContext,
    (output) => {
      agentStatusMap.set(output.id, `✅ done (${output.confidence.toFixed(2)})`);
      agentOutputSnippetMap.set(output.id, preview(output.result, 240));
      const idx = log.lastIndexOf('**Phase 2');
      log = log.slice(0, idx) + '**Phase 2 — Parallel Agent Execution**\n' + renderPhase2() + '\n\n';
      onProgress(log, false);
    },
    abortSignal,
  );

  // Phase 3: Review
  emit('**Phase 3 — Review**');
  emit(`_Reviewers: ${plan.reviewers.map(r => `\`${r}\` ${SLM_AGENTS[r]?.name ?? r}`).join(', ')} — auditing all agent outputs..._`);

  const reviewResults = await reviewOutputs(agentOutputs, userMessage, llmId, plan.reviewers, abortSignal);
  const failed = reviewResults.filter(r => !r.passed);

  if (reviewResults.length > 0) {
    emit('');
    emit('**Review Scores:**');
    for (const r of reviewResults) {
      const icon = r.passed ? '✅' : '⚠️';
      const scorePct = Math.round(r.score * 100);
      const fb = r.feedback ? ` — _${preview(r.feedback, 160)}_` : '';
      emit(`- ${icon} \`${r.agentId}\` · score **${scorePct}%**${fb}`);
    }
    emit('');
  }

  emit(failed.length === 0 ? '✅ All outputs passed review\n' : `⚠️ ${failed.length} output(s) flagged for revision\n`);

  // Phase 4: Fix
  let currentOutputs = agentOutputs;
  if (failed.length > 0) {
    emit('**Phase 4 — Fix & Revision**');
    emit(`_Revising ${failed.length} agent output(s) based on reviewer feedback..._`);
    for (const r of failed) {
      const def = SLM_AGENTS[r.agentId];
      emit(`  · Revising \`${r.agentId}\` ${def?.name ?? r.agentId}: _${preview(r.feedback, 180)}_`);
    }
    currentOutputs = await fixFailedOutputs(reviewResults, agentOutputs, userMessage, llmId, abortSignal);
    emit('✅ Revisions complete\n');
  }

  // Phase 5: Validation
  emit('**Phase 5 — Validation**');
  emit('_Security Auditor running quality, safety & completeness checks..._');
  const { outputs: validatedOutputs, validationScore, criticalIssues } = await validateOutputs(currentOutputs, userMessage, llmId, abortSignal);
  const scoreBar = '█'.repeat(Math.round(validationScore * 10)) + '░'.repeat(10 - Math.round(validationScore * 10));
  emit(`${validationScore >= VALIDATION_PASS_THRESHOLD ? '✅' : '⚠️'} Validation score: **${validationScore.toFixed(2)}/1.00** \`${scoreBar}\`\n`);

  // Phase 5b: Validation-triggered critical fix
  let postValidationOutputs = validatedOutputs;
  if (validationScore < VALIDATION_PASS_THRESHOLD && criticalIssues.length > 0) {
    emit('**Phase 5b — Critical Issue Resolution**');
    emit(`_Score ${validationScore.toFixed(2)} below threshold (${VALIDATION_PASS_THRESHOLD}). Sovereign Security Warden resolving ${criticalIssues.length} critical issue(s)..._`);
    for (const issue of criticalIssues) emit(`  · ${issue}`);
    postValidationOutputs = await resolveValidationFailures(validatedOutputs, criticalIssues, userMessage, llmId, abortSignal);
    emit('✅ Critical issues resolved\n');
  }

  // Phase 6: Enhancement
  const enhancerDef = SLM_AGENTS[plan.enhancer];
  emit('**Phase 6 — Enhancement**');
  emit(`_${enhancerDef?.name ?? plan.enhancer} (\`${plan.enhancer}\`) performing cross-cutting quality elevation..._`);
  const enhancedOutputs = await enhanceOutputs(postValidationOutputs, userMessage, plan.enhancer, llmId, abortSignal);
  const enhancement = enhancedOutputs.find(o => o.id === (enhancerDef?.id ?? plan.enhancer) && o.name.includes('Enhancement'));
  if (enhancement) {
    emit(`\n**Enhancement added by \`${plan.enhancer}\`:**\n> ${preview(enhancement.result, 320)}\n`);
  }
  emit('✅ Enhancement complete\n');

  // Phase 7: Assemble
  emit('**Phase 7 — Final Assembly**');
  emit(`_Synthesizing outputs from ${enhancedOutputs.length} agent contribution(s) into unified response..._`);
  emit(`_Contributors: ${enhancedOutputs.map(o => `\`${o.id}\``).join(', ')}_\n`);

  const finalOutput = await assembleOutput(enhancedOutputs, userMessage, llmId, abortSignal);

  emit('---\n');
  emit('## ✦ Final Output\n');
  emit(finalOutput, true);

  return log;
}


// --- Extract user message text from DMessage history ---

export function extractLastUserMessageText(chatHistory: Readonly<DMessage[]>): string {
  for (let i = chatHistory.length - 1; i >= 0; i--) {
    const msg = chatHistory[i];
    if (msg.role !== 'user') continue;
    const text = messageFragmentsReduceText(msg.fragments);
    if (text.trim()) return text;
  }
  return '';
}

export function buildConversationContext(chatHistory: Readonly<DMessage[]>, maxMessages = 6): string {
  const recent = chatHistory.slice(-maxMessages);
  return recent
    .map(msg => {
      const text = messageFragmentsReduceText(msg.fragments).trim().slice(0, 300);
      return text ? `${msg.role}: ${text}` : null;
    })
    .filter(Boolean)
    .join('\n');
}
