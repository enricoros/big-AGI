import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { EditorialDefaults, llmsEditorial_ModelIdForDomain_SLOW } from './model.domains.editorial';


// a model as the picker reads it; the ids are the table's own picks, so a table edit cannot make these cases vacuous
const [first, second] = EditorialDefaults.primaryChat;
const llm = (pick: { vendor: string, modelId: string }, hidden?: boolean, userHidden?: boolean) =>
  ({ id: `${pick.vendor}-${pick.modelId}`, vId: pick.vendor, initialParameters: { llmRef: pick.modelId }, hidden, userHidden }) as Parameters<typeof llmsEditorial_ModelIdForDomain_SLOW>[1][number];

describe('editorial picks and hidden models', () => {

  test('a pick the listing hides is skipped: the next pick wins', () => {
    assert.equal(llmsEditorial_ModelIdForDomain_SLOW(['primaryChat'], [llm(first), llm(second)]), llm(first).id);
    assert.equal(llmsEditorial_ModelIdForDomain_SLOW(['primaryChat'], [llm(first, true), llm(second)]), llm(second).id);
  });

  test('the user\'s own choice wins over the listing, both ways', () => {
    assert.equal(llmsEditorial_ModelIdForDomain_SLOW(['primaryChat'], [llm(first, true, false), llm(second)]), llm(first).id);
    assert.equal(llmsEditorial_ModelIdForDomain_SLOW(['primaryChat'], [llm(first, false, true), llm(second)]), llm(second).id);
  });

  test('nothing visible: no pick, the caller falls through', () => {
    assert.equal(llmsEditorial_ModelIdForDomain_SLOW(['primaryChat'], [llm(first, true), llm(second, true)]), undefined);
  });

});
