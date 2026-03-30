import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('participant model selectors use getLLMLabel so custom model names appear in agent settings', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{[\s\S]*getLLMLabel[\s\S]*\}\s*from '~\/common\/stores\/llms\/llms\.types';/);
  assert.equal((source.match(/\{getLLMLabel\(llm\)\}/g) ?? []).length >= 2, true);
  assert.match(source, /New agent uses \$\{getLLMLabel\(selectedParticipantLlm\)\}\.\$\{selectedParticipantReasoningConfig\.parameterId/);
  assert.match(source, /const llmLabel = participantLlm \? getLLMLabel\(participantLlm\) : participant\.llmId \?\? 'Chat model';/);
  assert.match(
    source,
    /import\s*\{[\s\S]*getReasoningEffortOptions,[\s\S]*getParticipantReasoningEffortCompactLabel,[\s\S]*\}\s*from '\.\/ChatBarChat\.reasoning';/,
  );
  assert.doesNotMatch(source, /<Option key=\{llm\.id\} value=\{llm\.id\}>\{llm\.label\}<\/Option>/);
});

test('new custom agents expose and persist the custom prompt field from the add-agent form', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /const \[draftCustomPrompt, setDraftCustomPrompt\] = React\.useState\(''\);/);
  assert.match(source, /const isDraftCustomPersonaSelected = draftPersonaId === 'Custom';/);
  assert.match(source, /if \(draftCustomPrompt\.trim\(\)\)\s*nextParticipant\.customPrompt = draftCustomPrompt\.trim\(\);/);
  assert.match(source, /\{isDraftCustomPersonaSelected && \(\s*<Input[\s\S]*placeholder='Optional custom prompt\/persona instructions'/);
});

test('expanded agent cards expose import and export actions', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(
    source,
    /import \{ buildAgentTransferFile, getAgentTransferFilename, parseAgentTransferFile \} from '~\/common\/stores\/chat\/store-chat-agent\.transfer';/,
  );
  assert.match(source, /const handleAgentExport = React\.useCallback/);
  assert.match(source, /const handleAgentImport = React\.useCallback/);
  assert.match(source, /const handleAgentDuplicate = React\.useCallback/);
  assert.match(source, /import ContentCopyIcon from '@mui\/icons-material\/ContentCopy';/);
  assert.match(source, />\s*Duplicate Agent\s*</);
  assert.match(source, />\s*Export Agent\s*</);
  assert.match(source, />\s*Import Agent\s*</);
});

test('expanded agent cards use a header delete icon instead of a footer remove button', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /import DeleteOutlineIcon from '@mui\/icons-material\/DeleteOutline';/);
  assert.match(source, /aria-label='Delete'/);
  assert.doesNotMatch(source, /startDecorator=\{<CloseIcon \/>}/);
  assert.doesNotMatch(source, />\s*Remove\s*</);
});

test('saved agent menu items include an inline delete icon', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /import \{ CloseablePopup, joyKeepPopup \} from '~\/common\/components\/CloseablePopup';/);
  assert.match(source, /deleteAgent: state\.deleteAgent/);
  assert.match(source, /const handleDeleteSavedAgent = React\.useCallback/);
  assert.match(source, /sortedSavedAgents\.map\(agent => \(\s*<MenuItem[\s\S]*aria-label='Delete'[\s\S]*handleDeleteSavedAgent\(agent\)/);
});

test('leader chip uses the participant accent color instead of a fixed primary color', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /\{participant\.isLeader && <Chip size='sm' variant='solid' color=\{participantAccentColor\}>Leader<\/Chip>\}/);
  assert.doesNotMatch(source, /\{participant\.isLeader && <Chip size='sm' variant='solid' color='primary'>Leader<\/Chip>\}/);
});

test('participants button only shows leader details outside human-driven multi-agent chats', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /const participantsButtonLabel = React\.useMemo\(\(\) => \{/);
  assert.match(source, /const leaderReasoningSummaryLabel = React\.useMemo\(\(\) => \{/);
  assert.match(source, /const showLeaderInParticipantsButton = assistantParticipants\.length > 1 && turnTerminationMode !== 'round-robin-per-human';/);
  assert.match(
    source,
    /if \(turnTerminationMode === 'council' && showLeaderInParticipantsButton\)\s*return leaderParticipant \? `Leader \$\{leaderParticipant\.name\}\$\{leaderReasoningSummaryLabel \? ` · \$\{leaderReasoningSummaryLabel\}` : ''\}` : 'Leader';/,
  );
  assert.match(source, /return `Agents \$\{assistantParticipants\.length > 1 \? assistantParticipants\.length : ''\}`;/);
  assert.match(source, /\{participantsButtonLabel\}/);
});

test('make leader button is only rendered in council mode', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /\{isExpanded && turnTerminationMode === 'council' && !participant\.isLeader && \(/);
});

test('compact participant summaries show the effective reasoning label', () => {
  const source = readFileSync(new URL('./ChatBarChat.tsx', import.meta.url), 'utf8');

  assert.match(source, /import\s*\{[\s\S]*getParticipantReasoningEffortCompactLabel,[\s\S]*\}\s*from '\.\/ChatBarChat\.reasoning';/);
  assert.match(source, /const reasoningSummaryLabel = getParticipantReasoningEffortCompactLabel\(\{/);
  assert.match(source, /\{llmLabel\}/);
  assert.match(source, /\{reasoningSummaryLabel\}/);
});
