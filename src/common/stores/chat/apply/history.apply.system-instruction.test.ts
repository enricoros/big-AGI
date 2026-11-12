/// <reference types="node" />

// The system instruction of a chat: what must hold for the system message from one send to the next.
// Run: `NODE_ENV=development npx tsx --test src/common/stores/chat/apply/history.apply.system-instruction.test.ts`

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// relative imports: the root tsconfig excludes tests, so the IDE's inferred project has no '~' paths (tsx and tools/tsconfig do)
import type { Immutable } from '../../../types/immutable.types';

import { createDMessageTextContent, DMessage, messageFragmentsReduceText } from '../chat.message';
import { createDMessageDataInlineText, createDocAttachmentFragment, createTextContentFragment } from '../chat.fragments';

import { historyApply_systemInstruction } from './history.apply.system-instruction';


const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const NOON = new Date(2001, 2, 4, 12).getTime(); // Sunday, March 4, 2001, noon on this device: a date no wall clock shows

const user = (text: string, created: number): DMessage => ({ ...createDMessageTextContent('user', text), created });
const reply = (text: string, created: number, endedAt?: number): DMessage =>
  ({ ...createDMessageTextContent('assistant', text), created, ...(endedAt && { generator: { mgt: 'named' as const, name: 'test', endedAt } }) });
const instruction = (text: string) => [createTextContentFragment(text)];
const textOf = (message: Immutable<DMessage> | null | undefined) => message ? messageFragmentsReduceText(message.fragments) : null;

const doc = createDocAttachmentFragment('notes.txt', '', 'text/plain', createDMessageDataInlineText('facts'), 'ref-notes', 1);


describe('the system instruction of a chat', () => {

  // The system message is the prefix of every request of a chat: while the chat is active its text must not move, or
  // every vendor's prompt cache misses. It takes a new date only with the user message that follows an idle hour.
  it('keeps its date while the chat is active, and takes a new one after an idle hour', () => {
    const dated = instruction('You are a helper.\nToday is {{Today}}, {{LocaleNow}}.');
    const send = (history: Immutable<DMessage[]>) => historyApply_systemInstruction(history, dated);

    // the first send dates it: the day and the hour of the message that started the chat
    let history = send([user('hi', NOON)]).nextHistory;
    const first = history[0];
    assert.equal(first.role, 'system');
    assert.match(textOf(first)!, /^You are a helper\.\nToday is 2001-03-04, Sun, Mar 4, 2001, 12\sPM \S+\.$/);

    // six hours of sends, never an hour apart: the hour moved six times, the text did not
    let last = NOON;
    for (; last < NOON + 6 * HOUR; last += 50 * MINUTE) {
      history = send([...history, reply('ok', last + MINUTE), user('more', last + 50 * MINUTE)]).nextHistory;
      assert.equal(textOf(history[0]), textOf(first));
    }

    // a reply that takes 50 minutes, answered 15 minutes after it ended: the prefix was in use 15 minutes ago
    history = send([...history, reply('long', last + MINUTE, last + 51 * MINUTE), user('and?', last + 66 * MINUTE)]).nextHistory;
    assert.equal(textOf(history[0]), textOf(first));

    // the reply to it is regenerated the next afternoon, and a message follows two minutes later: that reply answers
    // a request that carried the old date, so the date stays until a user message follows a pause
    const nextDay = new Date(2001, 2, 5, 15, 46).getTime();
    history = send([...history, reply('again', nextDay), user('thanks', nextDay + 2 * MINUTE)]).nextHistory;
    assert.equal(textOf(history[0]), textOf(first));

    // 61 minutes later, a user message: an idle hour passed, so the date is that message's. It is the same message
    // and the same text fragment, edited: ids stay
    const resumedAt = nextDay + 63 * MINUTE;
    const sentAfterPause = [...history, user('back', resumedAt)];
    const resumed = send(sentAfterPause);
    assert.equal(resumed.modified, true);
    assert.match(textOf(resumed.systemMessage)!, /^You are a helper\.\nToday is 2001-03-05, Mon, Mar 5, 2001, 04\sPM \S+\.$/);
    assert.equal(resumed.systemMessage?.id, first.id);
    assert.equal(resumed.systemMessage?.fragments[0].fId, first.fragments[0].fId);
    assert.deepEqual(resumed.nextHistory.slice(1), sentAfterPause.slice(1)); // the chat's own messages are as they were sent

    // and it holds from there
    history = send([...resumed.nextHistory, reply('welcome back', resumedAt + MINUTE), user('so', resumedAt + 30 * MINUTE)]).nextHistory;
    assert.equal(textOf(history[0]), textOf(resumed.systemMessage));
  });

  // `updated` on a system message means its text is the user's: no instruction applies to it any more
  it('leaves alone a system message the user edited, and one the caller froze', () => {
    const edited: DMessage = { ...createDMessageTextContent('system', 'My own instruction.'), updated: NOON };
    const history = [edited, user('hi', NOON)];
    const kept = historyApply_systemInstruction(history, instruction('Be brief.'));
    assert.equal(kept.modified, false);
    assert.equal(kept.nextHistory, history);
    assert.equal(kept.systemMessage, edited);

    // text typed by the user before the chat started: frozen at its first render, as an edit would be
    const frozen = historyApply_systemInstruction([user('hi', NOON)], instruction('Typed by the user.'), { freeze: true });
    const later = historyApply_systemInstruction(frozen.nextHistory, instruction('Another persona.'));
    assert.equal(later.modified, false);
    assert.equal(textOf(later.nextHistory[0]), 'Typed by the user.');
  });

  it('removes the system message for an empty instruction, and only ever takes message 0 for it', () => {
    // a system message later in the chat (a /system note) is a message like any other
    const chat = [user('hi', NOON), reply('hello', NOON + MINUTE), { ...createDMessageTextContent('system', 'A note, mid-chat.'), created: NOON + 2 * MINUTE }];
    const withSystem = historyApply_systemInstruction(chat, instruction('Be brief.')).nextHistory;
    assert.equal(textOf(withSystem[0]), 'Be brief.');
    assert.deepEqual(withSystem.slice(1), chat);

    const removed = historyApply_systemInstruction(withSystem, []);
    assert.equal(removed.modified, true);
    assert.equal(removed.systemMessage, null);
    assert.deepEqual(removed.nextHistory, chat);

    // nothing to remove: nothing happens
    const nothing = historyApply_systemInstruction(chat, []);
    assert.equal(nothing.modified, false);
    assert.equal(nothing.nextHistory, chat);

    // attachments are left out unless the caller says what they become: an instruction of only those is an empty one
    assert.deepEqual(historyApply_systemInstruction(withSystem, [doc]).nextHistory, chat);
  });

});
