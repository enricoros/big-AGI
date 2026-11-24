/// <reference types="node" />

// Trade: what an import does, decided before anything is written.
// Run: `NODE_ENV=development npx tsx --test src/modules/trade/trade.test.ts`
//
// 'by content' pins the rules for data with no version history (kb/modules/TRADE.md): which side is the
// successor, what is a conflict, and what a device rewrites on its own without it being a change.
// 'plan' pins what the user is shown for the hard inputs: several copies of one id in the loaded files,
// a conflict nobody decided, an item that cannot be compared, what arrives without the items of
// another kind that it needs, and what a file of one item holds.
// 'conversations' and 'settings' pin the kinds of data whose rules differ from the default.
// 'files' pins that every kind of file the app wrote is still read. The files are built here in the shapes
// their writers gave them: no real export is kept in the repository.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { DConversation } from '../../common/stores/chat/chat.conversation';

import type { TradeAdapter, TradeItem, TradeRelated } from './trade.types';
import { tradeChatsContent } from './adapters/trade.chats';
import { tradeFileRead } from './trade.files';
import { tradePlan, tradePlanOps, tradePreview, tradeRelateByContent, tradeSectionsOfItem } from './trade.plan';
import { tradeSettingsAdapters } from './adapters/trade.settings';


const IGNORE = new Set(['updated', 'tokenCount']);

const message = (id: string, text: string, extra?: object) =>
  ({ id, role: 'user', fragments: [{ ft: 'content', fId: 'f-' + id, part: { pt: 'text', text } }], created: 1, updated: null, ...extra });

const chat = (messages: object[], extra?: object) =>
  ({ id: 'c1', messages, created: 1, updated: 2, ...extra });

const byContent = (incoming: TradeItem, local: TradeItem): TradeRelated => tradeRelateByContent(incoming.data, local.data, IGNORE);


describe('by content', () => {

  const [m1, m2, m3] = [message('m1', 'one'), message('m2', 'two'), message('m3', 'three')];

  test('the side that only adds is the successor; what differs on the two sides is a conflict', () => {
    assert.deepEqual(tradeRelateByContent(chat([m1, m2, m3]), chat([m1, m2]), IGNORE), { relation: 'ahead' });
    assert.deepEqual(tradeRelateByContent(chat([m1, m2]), chat([m1, m2, m3]), IGNORE), { relation: 'behind' });
    // nothing says which side changed it
    assert.deepEqual(tradeRelateByContent(chat([m1, message('m2', 'two, edited')]), chat([m1, m2]), IGNORE), { relation: 'conflict' });
    assert.deepEqual(tradeRelateByContent(chat([m1], { userTitle: 'A' }), chat([m1], { userTitle: 'B' }), IGNORE), { relation: 'conflict' });
  });

  test('what a device rewrites on its own is not a change', () => {
    const local = chat([message('m1', 'one', { tokenCount: 12 })], { updated: 2, tokenCount: 12 });
    const incoming = chat([message('m1', 'one', { tokenCount: 40, updated: 9, userFlags: [], metadata: undefined })], { updated: 7, tokenCount: 40 });
    assert.deepEqual(tradeRelateByContent(incoming, local, IGNORE), { relation: 'same' });
  });

});


describe('plan', () => {

  const item = (id: string, data: object): TradeItem => ({ id, data });
  const [m1, m2] = [message('m1', 'one'), message('m2', 'two')];
  const older = item('c1', chat([m1]));
  const newer = item('c1', chat([m1, m2]));

  test('two exports of one chat loaded together make one row, the later version, in either file order', () => {
    for (const files of [[older, newer], [newer, older]]) {
      const { rows, rejected } = tradePlan(files, new Map(), new Set(), byContent);
      assert.deepEqual(rejected, []);
      assert.deepEqual(rows, [{ id: 'c1', incoming: newer, relation: 'new' }]);
    }
  });

  test('copies that conflict with each other are refused, not picked by file order', () => {
    const edited = item('c1', chat([message('m1', 'one, edited')]));
    const { rows, rejected } = tradePlan([older, edited], new Map(), new Set(), byContent);
    assert.deepEqual(rows, []);
    assert.deepEqual(rejected.map(r => r.id), ['c1']);
  });

  test('an item that cannot be compared is one refused item: the others are planned', () => {
    const throwing = (incoming: TradeItem, local: TradeItem): TradeRelated => {
      if (incoming.id === 'bad') throw new RangeError('Maximum call stack size exceeded');
      return byContent(incoming, local);
    };
    const local = new Map([['bad', item('bad', chat([m1]))], ['good', item('good', chat([m1]))]]);
    const { rows, rejected } = tradePlan([item('bad', chat([m1])), item('good', chat([m1, m2]))], local, new Set(), throwing);
    assert.deepEqual(rows.map(row => [row.id, row.relation]), [['good', 'ahead']]);
    assert.deepEqual(rejected.map(r => r.id), ['bad']);
  });

  test('a conflict nobody decided writes nothing; a policy or a row choice does', () => {
    const local = new Map([
      ['same', item('same', chat([m1]))],
      ['ahead', item('ahead', chat([m1]))],
      ['merge', item('merge', chat([m1], { userTitle: 'Here' }))],
      ['conflict', item('conflict', chat([m1], { userTitle: 'Here' }))],
    ]);
    const { rows } = tradePlan([
      item('new', chat([m1])),
      item('same', chat([m1])),
      item('ahead', chat([m1, m2])),
      item('merge', chat([m1, m2])),
      item('conflict', chat([m1], { userTitle: 'In the file' })),
    ], local, new Set(), byContent);

    const resolutions = (ops: ReturnType<typeof tradePlanOps>) => Object.fromEntries(ops.map(op => [op.item.id, op.resolution]));

    assert.deepEqual(resolutions(tradePlanOps(rows, new Map(), null)), { new: 'add', ahead: 'accept-incoming', merge: 'merge' });
    // each operation carries the local version it was decided against
    assert.deepEqual(tradePlanOps(rows, new Map(), null).map(op => op.local), [undefined, local.get('ahead'), local.get('merge')]);
    assert.deepEqual(resolutions(tradePlanOps(rows, new Map(), 'keep-both')), { new: 'add', ahead: 'accept-incoming', merge: 'merge', conflict: 'keep-both' });
    assert.deepEqual(
      resolutions(tradePlanOps(rows, new Map([['conflict', 'accept-local'], ['new', null]] as const), null)),
      { ahead: 'accept-incoming', merge: 'merge', conflict: 'accept-local' },
    );
  });

  // a kind of data over a list, whose items name the personas they need
  const kind = (type: string, local: TradeItem[]): TradeAdapter => ({
    type, label: type, labelPlural: type + 's', schema: type,
    localItems: async () => ({ items: local }),
    readSection: section => ({ items: section.items, rejected: [] }),
    relate: byContent,
    describe: item => ({ title: item.id }),
    refersTo: item => [{ type: 'persona', ids: (item.data as { needs?: string[] }).needs ?? [] }],
    apply: async () => ({ failed: [] }),
  });

  test('what arrives is counted when it needs an item that is neither on this device nor in the files', async () => {
    const chats = kind('chat', [item('c-here', { needs: ['p-nowhere'] })]);
    const personas = kind('persona', [item('p-here', {})]);
    const chatSection = {
      type: 'chat', schema: 'chat', items: [
        item('c-whole', { needs: ['p-here', 'p-file'] }),
        item('c-lacking', { needs: ['p-here', 'p-nowhere'] }),
        item('c-here', { needs: ['p-nowhere'] }), // not arriving: this device stays as it is
      ],
    };
    const personaSection = { type: 'persona', schema: 'persona', items: [item('p-file', {})] };
    const missing = async (sections: typeof chatSection[]) =>
      (await tradePreview(sections, [chats, personas])).groups[0].missing.map(({ referred, count }) => [referred.type, count]);

    assert.deepEqual(await missing([chatSection, personaSection]), [['persona', 1]]);
    // conversations alone: this device's personas are still read, and the one of the other file is now missing
    assert.deepEqual(await missing([chatSection]), [['persona', 2]]);
  });

  test('a file of one item holds it and the items it needs that are on this device, and no other', async () => {
    const chats = kind('chat', [item('c1', { needs: ['p1', 'p-deleted'] }), item('c2', { needs: ['p2'] })]);
    const personas = kind('persona', [item('p1', {}), item('p2', {})]);
    const sections = await tradeSectionsOfItem([chats, personas], 'chat', 'c1');
    assert.deepEqual(sections.map(section => [section.type, section.items.map(({ id }) => id)]), [['chat', ['c1']], ['persona', ['p1']]]);
    // an item this device does not export is said, not saved as an empty file
    await assert.rejects(tradeSectionsOfItem([chats, personas], 'chat', 'c-in-memory-only'));
  });

});


describe('conversations', () => {

  // the rules, with the store's calls as plain functions: what is read from a file is the conversation itself
  const rules = tradeChatsContent({
    fromJson: json => ({ ...(json as DConversation) }),
    import: conversation => conversation.id,
  });

  const [m1, m2, m3, m4] = [message('m1', 'one'), message('m2', 'two'), message('m3', 'continued here'), message('m4', 'continued in the file')];
  const item = (data: object): TradeItem => ({ id: 'c1', data });
  const read = (schema: string, data: object, local?: TradeItem) =>
    rules.readSection({ type: 'chat', schema, items: [item(data)] }, new Map(local ? [['c1', local]] : []));

  test('two continuations of one chat are a conflict, never one merged list', () => {
    assert.deepEqual(rules.relate(item(chat([m1, m2, m4])), item(chat([m1, m2, m3]))), { relation: 'conflict' });
  });

  test('a rename here and new messages in the file merge: the list of the file, the title of this device', () => {
    const related = rules.relate(item(chat([m1, m2, m4])), item(chat([m1, m2], { userTitle: 'Renamed here' })));
    assert.equal(related.relation, 'mergeable');
    const merged = (related as { merged: DConversation }).merged;
    assert.equal(merged.userTitle, 'Renamed here');
    assert.deepEqual(merged.messages.map(m => m.id), ['m1', 'm2', 'm4']);
  });

  test('an older chat file cannot carry the archive flag: the chat stays archived, and reads as the same', () => {
    const local = read('app-chats.v4', chat([m1], { isArchived: true, userSymbol: 'X' })).items[0];
    const { items, rejected } = read('rest-chat.v1', chat([m1]), local);
    assert.deepEqual(rejected, []);
    assert.equal((items[0].data as DConversation).isArchived, true);
    assert.deepEqual(rules.relate(items[0], local), { relation: 'same' });
  });

  test('a file is untrusted: an id that is not the one of its data, and fields of the wrong type, do not get in', () => {
    assert.deepEqual(rules.readSection({ type: 'chat', schema: 'app-chats.v4', items: [{ id: 'other', data: chat([m1]) }] }, new Map()).rejected.map(r => r.id), ['other']);
    const { data } = read('app-chats.v4', chat([m1], { userSymbol: { not: 'a string' }, isArchived: 'yes', userTitle: 7 })).items[0];
    assert.deepEqual([(data as DConversation).userSymbol, (data as DConversation).isArchived, (data as DConversation).userTitle], [undefined, undefined, undefined]);
  });

  test('fragment ids are not content: the messages of the oldest files get new ones at every read, and are the same chat', () => {
    const reread = { ...m1, fragments: [{ ...m1.fragments[0], fId: 'minted-at-this-read' }] };
    assert.deepEqual(rules.relate(item(chat([reread])), item(chat([m1]))), { relation: 'same' });
  });

});


describe('settings', () => {

  const [settings, credentials] = tradeSettingsAdapters();
  const stored = (id: string, state: object, version: unknown): TradeItem => ({ id, data: { state, version } });

  test('a store this version does not list, and a value saved by a newer or an unreadable version of a store, are refused', () => {
    const local = new Map([['app-ui', stored('app-ui', { zen: false }, 3)]]);
    const { items, rejected } = settings.readSection({
      type: 'settings', schema: 'store-value', items: [
        stored('app-ui', { zen: true }, 4),
        stored('app-fabric-cache', { userEmail: 'someone' }, 1),
        stored('app-models', { sources: [] }, 5),
        stored('app-app-chat', {}, '99'),
        stored('app-ux-labs', { labsBeam: true }, 2),
      ],
    }, local);
    assert.deepEqual(items.map(i => i.id), ['app-ux-labs']);
    assert.equal(rejected.length, 4);
    assert.deepEqual(credentials.readSection({ type: 'credentials', schema: 'store-value', items: [stored('app-models', { sources: [] }, 5)] }, new Map()).items.map(i => i.id), ['app-models']);
  });

  test('what describes the device is not a setting: it is not exported, not compared, and an import leaves it as it is here', async () => {
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) } });
    try {
      values.set('app-ui', JSON.stringify({ state: { zen: false, actionCounters: { sent: 5 }, dismissals: { tip: true } }, version: 3 }));
      const [here] = (await settings.localItems()).items;
      assert.deepEqual(here.data, { state: { zen: false }, version: 3 });

      // a file written before holds the counters of its device
      const read = (state: object) => settings.readSection({ type: 'settings', schema: 'store-value', items: [stored('app-ui', state, 3)] }, new Map([['app-ui', here]])).items[0];
      assert.deepEqual(settings.relate(read({ zen: false, actionCounters: { sent: 99 }, dismissals: {} }), here), { relation: 'same' });

      const changed = read({ zen: true, actionCounters: { sent: 99 } });
      assert.deepEqual(settings.relate(changed, here), { relation: 'ahead' });
      assert.deepEqual((await settings.apply([{ item: changed, local: here, relation: 'ahead', resolution: 'accept-incoming' }])).failed, []);
      assert.deepEqual(JSON.parse(values.get('app-ui')!), { state: { zen: true, actionCounters: { sent: 5 }, dismissals: { tip: true } }, version: 3 });
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

});


describe('files', () => {

  const textMessage = { id: 'm1', text: 'hello', role: 'user', tokenCount: 1, created: 1, updated: null }; // before May 2024: 'text', no fragments
  const oneChat = { id: 'c1', messages: [textMessage], systemPurposeId: 'Generic', created: 1, updated: 2 };
  const services = { sources: [{ id: 'openai', label: 'OpenAI', vId: 'openai', setup: { oaiKey: 'not-a-key' } }] };
  const folders = { folders: [{ id: 'f1', title: 'Work', conversationIds: ['c1'] }], enableFolders: true };
  const backup = (chatsStore: object, more: object) => ({
    metadata: { version: '1.2', timestamp: '2026-01-01T00:00:00.000Z', application: 'Big-AGI', backupType: 'full' },
    storage: {
      localStorage: {
        'app-ui': { state: {}, version: 3 },
        'app-models': { state: { sources: [] }, version: 5 },
        'app-folders': { state: folders, version: 0 },
        'app-device': { state: { localDeviceId: 'device' }, version: 1 },
        'agi-logger-log': {},
      },
      indexedDB: { 'keyval-store': { keyval: [{ key: 'app-chats', value: JSON.stringify(chatsStore) }, { key: 'app-chats-v3', value: '{}' }] }, 'Big-AGI': { largeAssets: [] }, 'zync-storage-anon': { entities: [] } },
    },
    ...more,
  });
  const exportFile = (more: object, chatSectionMore: object) => ({
    schema: 'vnd.agi.export', schemaVersion: 1,
    origin: { app: 'Big-AGI', tenantSlug: 'open', exported: '2026-01-01T00:00:00.000Z' },
    sections: [
      { type: 'chat', schema: 'app-chats.v4', items: [{ id: 'c1', data: oneChat }], ...chatSectionMore },
      { type: 'document', schema: 'agi.document', items: [{ id: 'd1', data: {} }] }, // a kind of data this build has no adapter for
    ],
    ...more,
  });

  const read = (json: object) => {
    const source = tradeFileRead('file.json', json);
    return { error: source.error, notes: source.notes, sections: source.sections.map(section => `${section.type} ${section.schema} ${section.items.length}`) };
  };

  test('every kind of file the app wrote is read into the sections it holds', () => {
    const backupSections = (chatSchema: string) => ['settings store-value 1', 'credentials store-value 1', 'folder app-folders 1', `chat ${chatSchema} 1`];
    const cases: [name: string, json: object, sections: string[]][] = [
      ['one chat, no schema', oneChat, ['chat rest-chat.v1 1']],
      ['all chats, no schema', { conversations: [oneChat, { ...oneChat, id: 'c2' }], models: services, folders }, ['chat rest-chat.v1 2', 'folder app-folders 1', 'llm-service llms.service 1']],
      ['all chats, before folders', { conversations: [oneChat], models: services }, ['chat rest-chat.v1 1', 'llm-service llms.service 1']],
      ['hosted, all chats', { schema: 'vnd.agi.stored-all', schemaVersion: 2, conversations: [{ schema: 'vnd.agi.stored-chat', schemaVersion: 2, ...oneChat }], models: services, folders }, ['chat vnd.agi.stored-chat 1', 'folder app-folders 1', 'llm-service llms.service 1']],
      ['hosted, one chat', { schema: 'vnd.agi.stored-chat', schemaVersion: 2, ...oneChat }, ['chat vnd.agi.stored-chat 1']],
      ['hosted, personas', { schema: 'vnd.agi.stored-personas', schemaVersion: 2, personas: [{ personaUid: 'p1', name: 'One' }] }, ['persona vnd.agi.stored-personas 1']],
      ['device backup, first spelling', backup({ state: { conversations: [oneChat] }, version: 4 }, { _t: 'agi.flash-backup', _v: 1 }), backupSections('app-chats.v4')],
      ['device backup, current spelling', backup({ state: { conversations: [oneChat] }, version: 4 }, { schema: 'vnd.agi.flash-backup', schemaVersion: 102000, tenantSlug: 'open' }), backupSections('app-chats.v4')],
      ['device backup, hosted before sync', backup({ state: { conversations: [oneChat] }, version: 5 }, { schema: 'vnd.agi.flash-backup', schemaVersion: 202000, tenantSlug: 'dev' }), backupSections('app-chats.v5')],
      ['export', exportFile({}, {}), ['chat app-chats.v4 1', 'document agi.document 1']],
    ];
    for (const [name, json, sections] of cases) {
      const source = read(json);
      assert.equal(source.error, undefined, name);
      assert.deepEqual(source.sections, sections, name);
    }
  });

  test('an export from the future is refused, whole or by section, never half read', () => {
    assert.ok(read(exportFile({ schemaVersion: 2 }, {})).error);
    assert.ok(read(exportFile({ requires: ['something-new'] }, {})).error);
    const bySection = read(exportFile({}, { requires: ['something-new'] }));
    assert.deepEqual(bySection.sections, ['document agi.document 1']);
    assert.equal(bySection.notes.length, 1);
  });

});
