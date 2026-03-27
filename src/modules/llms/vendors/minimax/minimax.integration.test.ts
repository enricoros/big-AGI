/**
 * MiniMax Vendor Integration Tests
 *
 * Tests the vendor configuration, transport access, and OpenAI access layer.
 * Requires MINIMAX_API_KEY environment variable for live API tests.
 *
 * Run with: npx tsx src/modules/llms/vendors/minimax/minimax.integration.test.ts
 */

import { ModelVendorMiniMax } from './minimax.vendor';

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

console.log('\n=== MiniMax Vendor Configuration Tests ===');

assert(ModelVendorMiniMax.id === 'minimax', 'Vendor ID is minimax');
assert(ModelVendorMiniMax.name === 'MiniMax', 'Vendor name is MiniMax');
assert(ModelVendorMiniMax.displayGroup === 'cloud', 'Display group is cloud');
assert(ModelVendorMiniMax.location === 'cloud', 'Location is cloud');
assert(ModelVendorMiniMax.instanceLimit === 1, 'Instance limit is 1');
assert(ModelVendorMiniMax.hasServerConfigKey === 'hasLlmMiniMax', 'Server config key is hasLlmMiniMax');


console.log('\n=== MiniMax Setup Initialization Tests ===');

const setup = ModelVendorMiniMax.initializeSetup!();
assert(setup.minimaxKey === '', 'Initial key is empty');
assert(setup.minimaxHost === '', 'Initial host is empty');


console.log('\n=== MiniMax Setup Validation Tests ===');

assert(!ModelVendorMiniMax.validateSetup!({ minimaxKey: '', minimaxHost: '' }), 'Empty key is invalid');
assert(!ModelVendorMiniMax.validateSetup!({ minimaxKey: 'short', minimaxHost: '' }), 'Short key is invalid');
assert(!ModelVendorMiniMax.validateSetup!({ minimaxKey: 'a'.repeat(31), minimaxHost: '' }), '31-char key is invalid');
assert(ModelVendorMiniMax.validateSetup!({ minimaxKey: 'a'.repeat(32), minimaxHost: '' }), '32-char key is valid');
assert(ModelVendorMiniMax.validateSetup!({ minimaxKey: 'a'.repeat(64), minimaxHost: '' }), '64-char key is valid');


console.log('\n=== MiniMax Transport Access Tests ===');

const access = ModelVendorMiniMax.getTransportAccess({
  minimaxKey: 'test-key-12345',
  minimaxHost: '',
});
assert(access.dialect === 'minimax', 'Transport dialect is minimax');
assert(access.oaiKey === 'test-key-12345', 'Transport passes API key correctly');
assert(access.oaiHost === '', 'Transport passes empty host when default');
assert(access.oaiOrg === '', 'Transport org is empty');
assert(access.heliKey === '', 'Transport Helicone key is empty');

const accessWithHost = ModelVendorMiniMax.getTransportAccess({
  minimaxKey: 'test-key-12345',
  minimaxHost: 'https://custom.api.com',
});
assert(accessWithHost.oaiHost === 'https://custom.api.com', 'Custom host is passed through');


console.log('\n=== MiniMax CSF Availability Tests ===');

assert(!ModelVendorMiniMax.csfAvailable!({}), 'CSF unavailable without key');
assert(!ModelVendorMiniMax.csfAvailable!({ minimaxKey: '' }), 'CSF unavailable with empty key');
assert(ModelVendorMiniMax.csfAvailable!({ minimaxKey: 'some-key' }) === true, 'CSF available with key');


async function runLiveTests() {
  console.log('\n=== MiniMax Live API Tests ===');

  const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY;
  if (!MINIMAX_API_KEY) {
    console.log('  SKIP: MINIMAX_API_KEY not set - skipping live API tests');
    return;
  }

  try {
    // Note: MiniMax has no /v1/models endpoint - models are hardcoded
    console.log('  INFO: MiniMax has no models listing API - using hardcoded model descriptions');

    // Test chat completions (simple ping)
    const chatResponse = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.5-highspeed',
        messages: [{ role: 'user', content: 'Reply with just "hello"' }],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });
    assert(chatResponse.ok, `Chat API returns HTTP ${chatResponse.status}`);

    const chatData = await chatResponse.json();
    assert(!!chatData.choices?.[0]?.message?.content, 'Chat API returns message content');
    console.log(`  INFO: Chat response: "${chatData.choices[0].message.content}"`);
  } catch (err) {
    failed++;
    console.error(`  FAIL: Live API test error: ${err}`);
  }
}

runLiveTests().then(() => {
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
});
