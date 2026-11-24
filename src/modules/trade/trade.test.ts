/// <reference types="node" />

// Trade: what an import does, decided before anything is written.
// Run: `NODE_ENV=development npx tsx --test src/modules/trade/trade.test.ts`
//
// 'by content' pins the rules for data with no version history (kb/modules/TRADE.md): which side is the
// successor, what is a conflict, and what a device rewrites on its own without it being a change.
// 'plan' pins what the user is shown for the hard inputs: several copies of one id in the loaded files,
// an item deleted here, a conflict nobody decided, an item that cannot be compared, and what arrives
// without the items of another kind that it needs.
// 'conversations', 'settings' and 'AI services' pin the kinds of data whose rules differ from the default.
// 'files' pins that every kind of file the app wrote is still read. The files are built here from the stored
// types the old writers declare (chats.converters.ts, BackupRestore.tsx): no real export is kept in the repository.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { DConversation } from '../../common/stores/chat/chat.conversation';

import type { TradeAdapter, TradeItem, TradeRelated } from './trade.types';
import { tradeChatsAdapter } from './adapters/trade.chats';
import { tradeFileRead } from './trade.files';
import { tradePlan, tradePlanOps, tradePreview, tradeRelateByContent } from './trade.plan';
import { tradeSettingsAdapters } from './adapters/trade.settings';


const IGNORE = new Set(['updated', 'tokenCount']);

const message = (id: string, text: string, extra?: object) =>
  ({ id, role: 'user', fragments: [{ ft: 'content', fId: 'f-' + id, part: { pt: 'text', text } }], created: 1, updated: null, ...extra });

const chat = (messages: object[], extra?: object) =>
  ({ id: 'c1', messages, created: 1, updated: 2, ...extra });

const byContent = (incoming: TradeItem, local: TradeItem): TradeRelated => tradeRelateByContent(incoming.data, local.data, IGNORE);


describe('by content', () => {

  const [m1, m2, m3] = [message('m1', 'one'), message('m2', 'two'), message('m3', 'three')];

  test('the side that only adds is the successor', () => {
    assert.deepEqual(tradeRelateByContent(chat([m1, m2, m3]), chat([m1, m2]), IGNORE), { relation: 'ahead' });
    assert.deepEqual(tradeRelateByContent(chat([m1, m2]), chat([m1, m2, m3]), IGNORE), { relation: 'behind' });
  });

  test('what differs on the two sides is a conflict: nothing says which side changed it', () => {
    assert.deepEqual(tradeRelateByContent(chat([m1, message('m2', 'two, edited')]), chat([m1, m2]), IGNORE), { relation: 'conflict' });
    assert.deepEqual(tradeRelateByContent(chat([m1], { userTitle: 'A' }), chat([m1], { userTitle: 'B' }), IGNORE), { relation: 'conflict' });
  });

  test('what a device rewrites on its own is not a change', () => {
    const local = chat([message('m1', 'one', { tokenCount: 12 })], { updated: 2, tokenCount: 12 });
    const incoming = chat([message('m1', 'one', { tokenCount: 40, updated: 9, userFlags: [], metadata: undefined })], { updated: 7, tokenCount: 40 });
    assert.deepEqual(tradeRelateByContent(incoming, local, IGNORE), { relation: 'same' });
  });

  test('only the keys the caller names are left out', () => {
    assert.deepEqual(tradeRelateByContent({ id: 's', updated: 2 }, { id: 's', updated: 1 }, new Set()), { relation: 'conflict' });
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

  test('an item deleted on this device is not new', () => {
    const { rows } = tradePlan([older], new Map(), new Set(['c1']), byContent);
    assert.equal(rows[0].relation, 'removed');
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

  test('what arrives is counted when it needs an item that is neither on this device nor in the files', async () => {
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

});


describe('conversations', () => {

  // the store's calls, without a store: what it reads from a file is the conversation itself, and, as
  // the real one does, it changes what it is given to import
  const imported: DConversation[] = [];
  let stored: DConversation[] = [];
  const adapter = tradeChatsAdapter({
    schema: 'app-chats.v4',
    list: () => stored,
    fromJson: json => ({ ...(json as DConversation) }),
    import: conversation => {
      imported.push(structuredClone(conversation));
      conversation.messages.length = 0;
      return conversation.id;
    },
    saved: async () => undefined,
  });

  const [m1, m2, m3, m4] = [message('m1', 'one'), message('m2', 'two'), message('m3', 'continued here'), message('m4', 'continued in the file')];
  const item = (data: object): TradeItem => ({ id: 'c1', data });
  const read = (schema: string, data: object, local?: TradeItem) =>
    adapter.readSection({ type: 'chat', schema, items: [item(data)] }, new Map(local ? [['c1', local]] : []));

  test('two continuations of one chat are a conflict, never one merged list', () => {
    assert.deepEqual(adapter.relate(item(chat([m1, m2, m4])), item(chat([m1, m2, m3]))), { relation: 'conflict' });
  });

  test('a rename here and new messages in the file merge: the list of the file, the title of this device', () => {
    const related = adapter.relate(item(chat([m1, m2, m4])), item(chat([m1, m2], { userTitle: 'Renamed here' })));
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
    assert.deepEqual(adapter.relate(items[0], local), { relation: 'same' });
  });

  test('an export carries the symbol: a file without it is a chat whose symbol was cleared, not this device\'s', () => {
    const local = read('app-chats.v4', chat([m1], { userSymbol: 'X' })).items[0];
    const { items } = read('app-chats.v4', chat([m1]), local);
    assert.equal((items[0].data as DConversation).userSymbol, undefined);
    assert.deepEqual(adapter.relate(items[0], local), { relation: 'behind' });
  });

  test('a file is untrusted: an id that is not the one of its data, and fields of the wrong type, do not get in', () => {
    assert.deepEqual(adapter.readSection({ type: 'chat', schema: 'app-chats.v4', items: [{ id: 'other', data: chat([m1]) }] }, new Map()).rejected.map(r => r.id), ['other']);
    const { data } = read('app-chats.v4', chat([m1], { userSymbol: { not: 'a string' }, isArchived: 'yes', userTitle: 7 })).items[0];
    assert.deepEqual([(data as DConversation).userSymbol, (data as DConversation).isArchived, (data as DConversation).userTitle], [undefined, undefined, undefined]);
  });

  test('fragment ids are not content: the messages of the oldest files get new ones at every read, and are the same chat', () => {
    const reread = { ...m1, fragments: [{ ...m1.fragments[0], fId: 'minted-at-this-read' }] };
    assert.deepEqual(adapter.relate(item(chat([reread])), item(chat([m1]))), { relation: 'same' });
  });

  test('what was decided is the pair the preview showed: a chat that moved since is not replaced', async () => {
    const previewed = item(chat([m1, m2]));
    const incoming = item(chat([m1, message('m2', 'two, as the file has it')]));
    const op = { item: incoming, local: previewed, relation: 'conflict', resolution: 'accept-incoming' } as const;

    // a reply arrived after the preview
    stored = [chat([m1, m2, m3]) as DConversation];
    const count = imported.length;
    assert.deepEqual((await adapter.apply([op])).failed.map(f => f.id), ['c1']);
    assert.equal(imported.length, count);

    // unchanged, apart from what the device rewrites on its own: written
    stored = [chat([m1, m2], { updated: 99, tokenCount: 7 }) as DConversation];
    assert.deepEqual((await adapter.apply([op])).failed, []);
    assert.equal(imported.length, count + 1);

    // keeping both does not replace: the chat may move
    stored = [chat([m1, m2, m3]) as DConversation];
    assert.deepEqual((await adapter.apply([{ ...op, resolution: 'keep-both' }])).failed, []);
    stored = [];
  });

  test('the store changes what it is given: the copy the preview shows is not the one it gets', async () => {
    const incoming = item(chat([m1, m2]));
    await adapter.apply([{ item: incoming, relation: 'new', resolution: 'add' }]);
    assert.equal(imported.at(-1)!.messages.length, 2);
    assert.equal((incoming.data as DConversation).messages.length, 2);
  });

  test('keeping both adds the chat of the file under new ids', async () => {
    await adapter.apply([{ item: item(chat([m1, m2])), relation: 'conflict', resolution: 'keep-both' }]);
    const copy = imported.at(-1)!;
    assert.notEqual(copy.id, 'c1');
    assert.equal(copy.messages.some(m => m.id === 'm1' || m.id === 'm2'), false);
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

  test('a stored value has no history: a different one in the file replaces the one of this device', () => {
    assert.deepEqual(settings.relate(stored('app-ui', { zen: true }, 3), stored('app-ui', { zen: false }, 3)), { relation: 'ahead' });
    assert.deepEqual(settings.relate(stored('app-ui', { zen: true }, 3), stored('app-ui', { zen: true }, 3)), { relation: 'same' });
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

  test('a device backup: what belongs to its device, or to another build, is in no section, and is one line with the names behind it', () => {
    const source = tradeFileRead('backup.json', backup({ state: { conversations: [oneChat] }, version: 4 }, {}));
    assert.deepEqual(source.sections.flatMap(section => section.items.map(item => item.id)), ['app-ui', 'app-models', 'f1', 'c1']);
    assert.equal(source.notes.length, 2); // what is not imported, however much of it; the images
    assert.equal(source.holdsImages, true); // saved with its images: the device restore is offered for it
    assert.equal(tradeFileRead('chat.json', oneChat).holdsImages, undefined);
    const [notImported, images] = source.notes;
    assert.deepEqual(notImported.names, ['app-device', 'agi-logger-log', 'app-chats-v3', 'zync-storage-anon']); // not 'app-folders': its folders are a section
    assert.ok(notImported.text.includes('3 stored values and 1 database'));
    assert.equal(images.names, undefined);
  });

  test('images are never in a chat file: the file says so', () => {
    const withImage = { ...oneChat, messages: [{ id: 'm1', role: 'user', fragments: [{ ft: 'content', fId: 'f1', part: { pt: 'image_ref', dataRef: { reftype: 'dblob', dblobAssetId: 'blob-1' } } }] }] };
    assert.equal(read(withImage).notes.length, 1);
    assert.ok(read(withImage).notes[0].text.includes('1 conversation shows them'));
    assert.equal(read(oneChat).notes.length, 0);
  });

  test('an export from the future is refused, whole or by section, never half read', () => {
    assert.ok(read(exportFile({ schemaVersion: 2 }, {})).error);
    assert.ok(read(exportFile({ requires: ['something-new'] }, {})).error);
    const bySection = read(exportFile({}, { requires: ['something-new'] }));
    assert.deepEqual(bySection.sections, ['document agi.document 1']);
    assert.equal(bySection.notes.length, 1);
  });

  test('what is not a Big-AGI file is an error, not an empty import', () => {
    assert.ok(read({ hello: 'world' }).error);
    assert.ok(read({ conversations: [], messages: [] }).error);
    assert.ok(read({ metadata: {}, storage: { localStorage: null } }).error);
  });

});
