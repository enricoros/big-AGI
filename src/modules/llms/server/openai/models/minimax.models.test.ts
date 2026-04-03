/**
 * MiniMax Models - Unit Tests
 *
 * Run with: npx tsx src/modules/llms/server/openai/models/minimax.models.test.ts
 */

import { minimaxModelFilter, minimaxModelToModelDescription, minimaxModelSort } from './minimax.models';

// --- Unit Tests ---

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

console.log('\n=== MiniMax Model Filter Tests ===');

// Known chat models should pass the filter
assert(minimaxModelFilter('MiniMax-M2.7'), 'MiniMax-M2.7 passes filter');
assert(minimaxModelFilter('MiniMax-M2.5'), 'MiniMax-M2.5 passes filter');
assert(minimaxModelFilter('MiniMax-M2.5-highspeed'), 'MiniMax-M2.5-highspeed passes filter');

// Embedding and speech models should be filtered out
assert(!minimaxModelFilter('embo-01'), 'embo-01 is filtered out');
assert(!minimaxModelFilter('speech-2.8-hd'), 'speech-2.8-hd is filtered out');

// Unknown models should still pass
assert(minimaxModelFilter('MiniMax-M3.0'), 'Unknown future model passes filter');


console.log('\n=== MiniMax Model Description Tests ===');

const m27 = minimaxModelToModelDescription('MiniMax-M2.7');
assert(m27.id === 'MiniMax-M2.7', 'M2.7 id matches');
assert(m27.label === 'MiniMax M2.7', 'M2.7 label matches');
assert(m27.contextWindow === 204800, 'M2.7 context window is 200K');
assert(m27.maxCompletionTokens === 16384, 'M2.7 max completion tokens is 16384');
assert(m27.interfaces.includes('oai-chat'), 'M2.7 supports chat');
assert(m27.interfaces.includes('oai-chat-fn'), 'M2.7 supports function calling');
assert(m27.interfaces.includes('oai-chat-json'), 'M2.7 supports JSON mode');
assert(m27.interfaces.includes('oai-chat-vision'), 'M2.7 supports vision');

const m25 = minimaxModelToModelDescription('MiniMax-M2.5');
assert(m25.id === 'MiniMax-M2.5', 'M2.5 id matches');
assert(m25.label === 'MiniMax M2.5', 'M2.5 label matches');

const m25hs = minimaxModelToModelDescription('MiniMax-M2.5-highspeed');
assert(m25hs.id === 'MiniMax-M2.5-highspeed', 'M2.5-highspeed id matches');
assert(m25hs.label === 'MiniMax M2.5 High-Speed', 'M2.5-highspeed label matches');

// Unknown model should get fallback
const unknown = minimaxModelToModelDescription('MiniMax-M3.0-preview');
assert(unknown.id === 'MiniMax-M3.0-preview', 'Unknown model id is preserved');
assert(unknown.hidden === true, 'Unknown model is hidden by default');


console.log('\n=== MiniMax Model Sort Tests ===');

const models = [m25hs, unknown, m25, m27].sort(minimaxModelSort);
assert(models[0].id === 'MiniMax-M2.7', 'M2.7 sorts first');
assert(models[1].id === 'MiniMax-M2.5', 'M2.5 sorts second');
assert(models[2].id === 'MiniMax-M2.5-highspeed', 'M2.5-highspeed sorts third');
assert(models[3].id === 'MiniMax-M3.0-preview', 'Unknown model sorts last');


console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
