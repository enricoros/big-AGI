import assert from 'node:assert/strict';
import test from 'node:test';

import { aixClassifyStreamingError } from './aix.client.errors';


test('classifies @stop string reasons as client aborts even without AbortError wrappers', () => {
  const result = aixClassifyStreamingError('@stop', false, false);

  assert.deepEqual(result, {
    errorType: 'client-aborted',
    errorMessage: '',
  });
});

test('classifies stop-like Error messages as client aborts', () => {
  const result = aixClassifyStreamingError(new Error('chat-stop'), false, false);

  assert.deepEqual(result, {
    errorType: 'client-aborted',
    errorMessage: '',
  });
});
