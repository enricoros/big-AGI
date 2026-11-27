// The browser pass: runs the cases of cases.json in this page, by itself, in any browser that opens the relay's
// /__sim/browser. The relay injects this script into the app's page.
//
// It works the app as a person does (the model picker, the composer, Stop), arms the relay's faults, and reads each
// stored message back from IndexedDB. Its state is in localStorage, so it survives the reload between its two phases:
// 'relay' (calls cross our server) and 'direct' (Direct Connection on, the browser calls the service itself).
// Needs the OpenAI service added once in this browser, with the simulator as its API host.
// Reads the open-source build's storage ('keyval-store' / 'app-chats' and 'app-models'): not the synced one of the hosted build.
(() => {
  const KEY = '__sim_pass';
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { state = null; }
  if (!state) return;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const save = () => localStorage.setItem(KEY, JSON.stringify(state));
  const arm = (fault, count) => fetch(`/__sim?fault=${fault}${count ? `&count=${count}` : ''}`).catch(() => undefined);
  const report = (done) => fetch('/__sim/report', { method: 'POST', body: JSON.stringify({ browser: navigator.userAgent, done, results: state.results }) }).catch(() => undefined);

  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;z-index:2147483647;right:10px;bottom:10px;background:#0b3d91;color:#fff;font:12px/1.4 monospace;padding:8px 12px;border-radius:8px;max-width:460px;white-space:pre-wrap;pointer-events:none';
  const say = (text) => { banner.textContent = 'simulator: ' + text; if (!banner.isConnected && document.body) document.body.appendChild(banner); };

  // the pass ended before this load (it reloads once at its end, to put the settings back): say so, and be gone
  if (state.done) {
    localStorage.removeItem(KEY);
    return say(`done: ${state.results.filter(r => r.ok).length} of ${state.results.length} as expected. You can close this tab.`);
  }

  // --- the app, as a person works it ---

  const composer = () => document.querySelector('textarea[placeholder*="Type"]');
  const pickers = () => [...document.querySelectorAll('button[role=combobox]')];
  const fire = (element, type) => element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  const click = (element) => { fire(element, 'mousedown'); fire(element, 'mouseup'); fire(element, 'click'); };
  const buttonOf = (text) => [...document.querySelectorAll('button')].find(button => button.textContent.trim().startsWith(text));
  const generating = () => !!buttonOf('Stop');

  async function ready() {
    for (let i = 0; i < 240; i++) {
      if (pickers().length >= 2 && composer()) return;
      await sleep(500);
    }
    throw new Error('the app did not show its model picker and composer');
  }

  /** Picks the model whose label is the id, however the app prettifies it ('[?] GPT-5 [sim ok~http401]', 'sim ok') */
  async function pick(modelId) {
    const plain = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '');
    click(pickers()[1]);
    await sleep(700);
    const options = [...document.querySelectorAll('[role=option]')];
    const wanted = plain(modelId);
    const option = options.find(o => plain(o.textContent) === wanted) || options.find(o => plain(o.textContent).endsWith(wanted));
    if (!option) { document.body.click(); return null; }
    click(option);
    await sleep(500);
    return pickers()[1].textContent.trim();
  }

  async function send() {
    const textarea = composer();
    textarea.focus();
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(textarea, 'hi');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(400);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    await sleep(300);
    if (composer()?.value === 'hi') buttonOf('Chat')?.click(); // the key did not send: the composer's own button
  }

  /** The last assistant message as stored: its id, stop reason and fragments */
  async function lastStored() {
    const db = await new Promise((resolve, reject) => { const open = indexedDB.open('keyval-store'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    const raw = await new Promise((resolve, reject) => { const get = db.transaction('keyval').objectStore('keyval').get('app-chats'); get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
    db.close();
    const chats = (typeof raw === 'string' ? JSON.parse(raw) : raw)?.state?.conversations ?? [];
    const chat = chats.slice().sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    const message = chat?.messages.filter(m => m.role === 'assistant').at(-1);
    if (!message) return null;
    return {
      id: message.id,
      stop: message.generator?.tokenStopReason,
      issues: message.fragments.filter(f => f.part?.pt === 'aix.issue').map(({ part: { issue: { atMs, ...issue } } }) => issue),
      text: message.fragments.filter(f => f.part?.pt === 'text').map(f => f.part.text.slice(0, 60)),
    };
  }

  // --- one case ---

  async function run(row) {
    say(`${state.phase} ${state.index + 1}: ${row.name}`);
    const picked = await pick(row.model);
    if (!picked) return { name: row.name, ok: false, error: `no model '${row.model}' in the picker` };
    const before = await lastStored();
    if (row.fault) await arm(row.fault, row.count);
    await send();
    if (row.stopAfter) { await sleep(row.stopAfter * 1000); buttonOf('Stop')?.click(); }
    await sleep(1000);
    for (let waited = 0; generating() && waited < 60_000; waited += 500) await sleep(500);
    await sleep(2000); // the store writes after the generation ends
    if (row.fault) await arm('none');

    const stored = await lastStored();
    const fresh = !!stored && stored.id !== before?.id;
    const first = fresh && stored.issues[0] ? `${stored.issues[0].code}:${stored.issues[0].effect}` : '-';
    const got = `${first}${fresh ? '' : ' (no new message)'}`;
    const ok = fresh && first === row.expect && (row.stop === undefined || stored.stop === row.stop);
    return { name: row.name, phase: state.phase, model: picked, ok, expect: `${row.expect}${row.stop ? ` / ${row.stop}` : ''}`, got: `${got}${fresh && stored.stop ? ` / ${stored.stop}` : ''}`, issues: fresh ? stored.issues : [], text: fresh ? stored.text : [] };
  }

  async function runPhase(rows) {
    if (state.index === 0) { buttonOf('New chat')?.click(); await sleep(900); }
    for (; state.index < rows.length; state.index++, save(), await report(false)) {
      try { state.results.push(await run(rows[state.index])); }
      catch (error) { state.results.push({ name: rows[state.index].name, phase: state.phase, ok: false, error: String(error?.message || error) }); }
    }
  }

  // Direct Connection of the services that point at this machine, as their setup panel stores it
  const isLocal = (source) => /127\.0\.0\.1|localhost/.test(JSON.stringify(source.setup ?? {}));
  const directNow = () => JSON.parse(localStorage.getItem('app-models')).state.sources.filter(source => isLocal(source) && source.setup.csf).map(source => source.id);
  /** `on`: true or false for all of them, or the ids of the ones to turn on (the rest off) */
  function setDirect(on) {
    const models = JSON.parse(localStorage.getItem('app-models'));
    for (const source of models.state.sources.filter(isLocal)) {
      if (Array.isArray(on) ? on.includes(source.id) : on) source.setup.csf = true;
      else delete source.setup.csf;
    }
    localStorage.setItem('app-models', JSON.stringify(models));
  }
  const reloadInto = (phase) => { state.phase = phase; state.index = 0; save(); location.reload(); };

  (async () => {
    try {
      const cases = await (await fetch('/__sim/cases')).json();
      await ready();
      await sleep(1500);
      await arm('none');
      // each phase starts from a reload, so the app reads the setting this script changed
      if (state.phase === 'start') {
        state.directBefore = directNow();
        setDirect(state.only === 'direct');
        return reloadInto(state.only === 'direct' ? 'direct' : 'relay');
      }
      await runPhase(cases[state.phase]);
      if (state.phase === 'relay' && !state.only) { setDirect(true); return reloadInto('direct'); }
    } catch (error) {
      state.results.push({ name: 'runner', phase: state.phase, ok: false, error: String(error?.message || error) });
    }
    // the end: report, put Direct Connection back as it was found, and reload so the app reads it
    state.done = true; save(); await report(true);
    if (state.directBefore) setDirect(state.directBefore);
    location.reload();
  })();
})();
