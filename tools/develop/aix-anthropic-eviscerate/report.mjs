import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './lib.mjs';

const load = id => JSON.parse(fs.readFileSync(path.join(OUT, `${id}.json`), 'utf8'));
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// render a content array as a sequence of colored block chips
function seq(content) {
  if (!content) return '<span class="muted">(none)</span>';
  return '<div class="seq">' + content.map(b => {
    let cls = 'blk', label = b.type, sub = '';
    if (b.type === 'text') { cls += ' t-text'; label = 'text'; sub = `${(b.text || '').length}c`; }
    else if (b.type === 'thinking') { cls += ' t-text'; label = 'thinking'; }
    else if (b.type === 'server_tool_use') { cls += ' t-srv'; label = 'SRV ' + b.name; sub = '#' + (b.id || '').slice(-6); }
    else if (b.type === 'tool_use') { cls += ' t-cli'; label = 'CLIENT ' + b.name; sub = '#' + (b.id || '').slice(-6); }
    else if (b.type && b.type.endsWith('_tool_result')) { cls += ' t-res'; label = b.type.replace('_tool_result', ''); sub = 'result'; }
    let caller = '';
    if (b.caller) caller = `<span class="caller">${b.caller.type === 'direct' ? 'direct' : 'code-exec'}${b.caller.tool_id ? '·' + b.caller.tool_id.slice(-6) : ''}</span>`;
    return `<span class="${cls}" title="${esc(b.type)}">${esc(label)}<em>${sub}</em>${caller}</span>`;
  }).join('<span class="arr">→</span>') + '</div>';
}
const usageLine = u => u ? `in <b>${u.input_tokens}</b> · out <b>${u.output_tokens}</b>${u.server_tool_use && (u.server_tool_use.web_search_requests || u.server_tool_use.web_fetch_requests) ? ` · search ${u.server_tool_use.web_search_requests} fetch ${u.server_tool_use.web_fetch_requests}` : ''}` : '';

// pull data
const s1 = load('s1_direct_custom'), s2a = load('s2a_hosted_dynamic'), s2b = load('s2b_hosted_direct');
const s3 = load('s3_ptc_custom'), s4 = load('s4_ptc_plus_search'), s5 = load('s5_mixing_direct'), s6a = load('s6a_response_excluded');
const ret = load('_retention_results'), r3 = load('_r3clean');
const tok = load('_tokacct'), pr2 = load('_probes2'), tsr = load('_toolsearch'), bser = load('_bserial2');
const tokByBase = b => tok.filter(r => r.base === b);
const tokRow = r => `<tr><td class="mono">${esc(r.ablation)}</td><td class="mono">${r.http === 200 ? '<span class="ok">'+r.infer_input+'</span>' : '<span class="bad">400</span>'}</td><td class="mono small">${r.http === 200 ? esc(r.answer) : esc(r.err)}</td></tr>`;
const csRow = r => `<tr><td class="mono">${esc(r.name)}</td><td>${r.status === 200 ? '<span class="ok">200</span>' : '<span class="bad">'+r.status+'</span>'}</td><td class="mono small">${esc(r.err || r.note || '')}</td></tr>`;
const serialCell = bser.find(t => t.code && t.code.includes('while') && !t.code.includes('json.loads')) || bser[2] || {};
const serialCellId = (serialCell.codeId || '').slice(-6) || '(cell)';

const s3code = s3.turns[0].content.find(b => b.name === 'code_execution')?.input?.code || '';
const s3stdout = s3.turns[1]?.content.find(b => b.type === 'code_execution_tool_result')?.content?.stdout || '';
const s4code = s4.turns[0].content.find(b => b.name === 'code_execution')?.input?.code || '';
const s2aNested = s2a.turns[0].content.find(b => b.type === 'server_tool_use' && b.name === 'web_search');
const s6aResult = s6a.turns[0].content.find(b => b.type === 'code_execution_tool_result');

function turnRows(d) {
  return d.turns.map(t => `<tr><td>${t.turn}</td><td><span class="pill ${t.stop_reason === 'tool_use' ? 'p-pause' : t.error ? 'p-err' : 'p-end'}">${t.error ? 'ERROR' : t.stop_reason}</span></td><td>${seq(t.content)}</td><td class="nowrap">${usageLine(t.usage)}</td></tr>`).join('');
}

const retRow = r => `<tr><td class="mono">${esc(r.name)}</td><td>${r.status === 200 ? '<span class="ok">200 ' + r.stop + '</span>' : '<span class="bad">400</span>'}</td><td>${esc(r.hypothesis)}</td><td class="mono small">${r.status === 200 ? '' : esc((r.errMsg || '').slice(0, 120))}</td></tr>`;

const html = `<title>Anthropic API - Hosted + Client Tools, Programmatic Calling & Retention (live eviscerate)</title>
<style>
:root{--bg:#0b0d0a;--panel:#14171200;--card:#151812;--ink:#e8ece2;--dim:#9aa38c;--lime:#d5ec31;--srv:#5aa9ff;--cli:#ffcf4d;--res:#7c8474;--line:#2a2f24;}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:0 0 120px}
.wrap{max-width:1040px;margin:0 auto;padding:0 22px}
header{border-bottom:1px solid var(--line);padding:40px 0 26px;margin-bottom:8px}
h1{font-size:27px;margin:0 0 6px;letter-spacing:-.4px}
h1 b{color:var(--lime)}
.sub{color:var(--dim);font-size:14px}
h2{font-size:20px;margin:44px 0 4px;padding-top:16px;border-top:1px solid var(--line);letter-spacing:-.2px}
h2 .n{color:var(--lime);font-variant-numeric:tabular-nums;margin-right:10px}
h3{font-size:15px;margin:22px 0 8px;color:var(--lime)}
p{margin:10px 0}
.lede{color:var(--dim);margin:2px 0 8px;font-size:14.5px}
a{color:var(--lime)}
code,.mono{font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:13px 15px;overflow:auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12.5px;line-height:1.5;color:#d6dcc9}
pre .k{color:var(--srv)} pre .s{color:var(--cli)}
.tldr{background:linear-gradient(180deg,#171b11,#12140f);border:1px solid var(--line);border-left:3px solid var(--lime);border-radius:10px;padding:6px 20px;margin:22px 0}
.tldr li{margin:9px 0}
.q{color:var(--lime);font-weight:600}
table{border-collapse:collapse;width:100%;margin:12px 0;font-size:13.5px}
th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#12150f;color:var(--dim);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.4px}
td.nowrap{white-space:nowrap;color:var(--dim);font-size:12px}
.small{font-size:12px}
.seq{display:flex;flex-wrap:wrap;align-items:center;gap:3px}
.blk{display:inline-flex;align-items:baseline;gap:5px;border-radius:5px;padding:2px 7px;font-size:11.5px;font-family:"JetBrains Mono",monospace;border:1px solid var(--line);background:#10130d;white-space:nowrap}
.blk em{font-style:normal;color:var(--dim);font-size:10px}
.blk.t-srv{color:var(--srv);background:#0e1622;border-color:#23405e}
.blk.t-cli{color:var(--cli);background:#221d0e;border-color:#5e4d23}
.blk.t-res{color:var(--res);background:#14160f}
.blk.t-text{color:var(--dim)}
.caller{font-size:9.5px;background:#000;border:1px solid var(--line);border-radius:3px;padding:0 4px;color:var(--dim)}
.arr{color:#39402f;font-size:11px}
.pill{font-family:"JetBrains Mono",monospace;font-size:11px;padding:2px 7px;border-radius:4px;white-space:nowrap}
.p-pause{background:#221d0e;color:var(--cli);border:1px solid #5e4d23}
.p-end{background:#10160d;color:#8fbf5a;border:1px solid #2f4a1d}
.p-err{background:#241010;color:#ff8a8a;border:1px solid #5e2323}
.ok{color:#8fbf5a;font-family:monospace;font-size:12px}
.bad{color:#ff8a8a;font-family:monospace;font-weight:700}
.muted{color:var(--dim)}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--dim);margin:6px 0 2px}
.note{background:#12140f;border:1px solid var(--line);border-radius:8px;padding:10px 15px;margin:14px 0;font-size:13.5px}
.note b{color:var(--lime)}
.win{border-left:3px solid var(--lime)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:720px){.grid2{grid-template-columns:1fr}}
.foot{color:#5a6150;font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:16px}
kbd{background:#000;border:1px solid var(--line);border-bottom-width:2px;border-radius:4px;padding:1px 5px;font-family:monospace;font-size:11px;color:var(--lime)}
</style>

<div class="wrap">
<header>
<h1><b>Eviscerating</b> the Anthropic API: hosted tools × client functions × programmatic calling</h1>
<div class="sub">Direct, streaming calls to <code>api.anthropic.com/v1/messages</code> · model <code>claude-opus-4-8</code> · 8 behavioural scenarios + retention/token/constraint probes, all live. No SDK, no app layer. Harness: <code>tools/develop/aix-anthropic-eviscerate/</code></div>
</header>

<p class="lede">Goal: find out what actually happens when your client functions, the latest hosted web search/fetch, and the code-execution sandbox all share one turn - the block compositions, where the stream hands control back to you, whether your functions get called <em>from inside code</em>, how hosted+client calls interleave, and above all <b>what you can and cannot omit on the next turn</b>.</p>

<div class="tldr">
<ul>
<li><span class="q">Will my functions be called from code blocks?</span> <b>Yes.</b> A client tool tagged <code>allowed_callers:["code_execution_20260120"]</code> is exposed to Claude's Python as an <code>async</code> function. Claude writes <code>await asyncio.gather(...)</code> and fires <b>parallel calls in one pause</b>, all tagged <code>caller.type=code_execution_20260120</code> with the same <code>tool_id</code> = the code-exec block. You return all results in one message; the code resumes.</li>
<li><span class="q">Hosted + client tools together?</span> <b>Interleaved under one code-exec parent.</b> In a single cell Claude can run <code>gather(lookup_metric(a), lookup_metric(b), web_search(q))</code>: the hosted <code>web_search</code> executes <b>server-side inline</b> (result appears immediately), while the client calls <b>pause for you</b> - same container, same code-exec <code>tool_id</code>.</li>
<li><span class="q">Does the stream stop to hand control back?</span> Yes, exactly at client-tool boundaries: <code>stop_reason:"tool_use"</code>. Pure hosted work never stops for you (it runs server-side, occasionally <code>pause_turn</code>).</li>
<li><span class="q">Does the code-exec output make the hosted fragments unnecessary next turn?</span> <b>Confirmed.</b> Hosted results called <em>from code</em> (dynamic filtering / PTC) can be <b>dropped entirely</b> on the next turn - no 400, and <b>zero</b> change in input tokens. They are not in Claude's context; only the <code>code_execution_tool_result</code> is. <code>response_inclusion:"excluded"</code> makes the API drop them from the response for you.</li>
<li><span class="q">Contrast - 1st-party hosted results.</span> A <em>directly</em>-called <code>web_search</code> result <b>must</b> be echoed back verbatim incl. <code>encrypted_content</code> - delete it and you get a <b>400</b>. So: the API keeps hosted fragments <em>only when they were called first-party</em>; code-exec-called ones are filtered/optional.</li>
</ul>
</div>

<div class="legend">
<span class="blk t-srv">SRV<em>server</em></span> Anthropic-executed (hosted) tool
<span class="blk t-cli">CLIENT<em>you</em></span> your function - needs a result from you
<span class="blk t-res">result</span> tool result block
<span class="caller">direct / code-exec·id</span> the <code>caller</code> field
</div>

<h2><span class="n">0</span>Environment reality check</h2>
<p class="lede">The live API is well ahead of static docs from early 2026.</p>
<ul>
<li>Web tools now ship in three tiers: <code>web_search_20250305</code> (basic) → <code>_20260209</code> (adds <b>dynamic filtering</b>) → <code>web_search_20260318</code> (adds <b>response_inclusion</b>). Same ladder for <code>web_fetch</code>.</li>
<li><code>code_execution_20260120</code> is GA (REPL state + <b>programmatic tool calling</b>). <b>No <code>anthropic-beta</code> header required</b> - just <code>anthropic-version: 2023-06-01</code>.</li>
<li><b>The latest web tools default to running inside code execution</b> (<code>allowed_callers</code> defaults to <code>["code_execution_20260120"]</code>). "Latest search+fetch" = dynamic filtering unless you opt out with <code>["direct"]</code>.</li>
</ul>

<h2><span class="n">1</span>Baseline - client tools called directly</h2>
<p class="lede">Two <code>get_weather</code> calls. Establishes the <code>caller</code> field &amp; the pause/resume shape.</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s1)}</tbody></table>
<p>Every <code>tool_use</code> carries <code>caller:{type:"direct"}</code> even for ordinary tool use - the <code>caller</code> field is <b>universal</b>, not PTC-only. Turn ends <code>tool_use</code>; you return <code>tool_result</code> blocks; the next turn finishes.</p>

<h2><span class="n">2</span>The big one - your function, called from Claude's code (PTC)</h2>
<p class="lede">Tools: <code>code_execution_20260120</code> + <code>lookup_metric</code> with <code>allowed_callers:["code_execution_20260120"]</code>. Prompt asks for six lookups + a max/sum.</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s3)}</tbody></table>
<p>The code Claude actually wrote:</p>
<pre>${esc(s3code)}</pre>
<p><code>asyncio.gather</code> ⇒ all calls arrive in a <b>single pause</b> (parallel). You answer all of them in one user message of <code>tool_result</code> blocks; the code resumes and prints:</p>
<pre>${esc(s3stdout)}</pre>
<div class="note win"><b>Key structural fact.</b> The nested <code>tool_use</code>/<code>tool_result</code> pairs are the <em>plumbing</em> for the code; the model only ever sees the final <code>stdout</code>. Confirmed by retention probe <b>R2</b> below: strip all nested pairs on the next turn and input tokens don't move.</div>

<h2><span class="n">3</span>Hosted + client tools interleaved in one code cell</h2>
<p class="lede">Tools: code-exec + <code>web_search</code> (defaults to code-exec caller) + <code>lookup_metric</code> (code-exec caller). "Get scores for alpha,bravo AND search Iceland's population."</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s4)}</tbody></table>
<p>One cell, both tool kinds:</p>
<pre>${esc(s4code.slice(0, 520))}${s4code.length > 520 ? '…' : ''}</pre>
<div class="note"><b>The tool-in-tool composition.</b> Inside the code-exec block: <code>web_search</code> resolves <b>server-side inline</b> (its <code>server_tool_use</code>+<code>web_search_tool_result</code> both appear, both tagged with the parent's <code>tool_id</code>), while the <code>lookup_metric</code> calls <b>defer to you</b> (client <code>tool_use</code>, same <code>tool_id</code>). Hosted and client tools genuinely interleave under a single code-execution parent.</div>

<h2><span class="n">4</span>Latest hosted search+fetch, on their own (dynamic filtering)</h2>
<p class="lede">Just <code>web_search_20260318</code> + <code>web_fetch_20260318</code>, defaults. No client tools.</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s2a)}</tbody></table>
<p>Never stops for you. Every hosted call is <b>wrapped inside a <code>code_execution</code> block</b> - the model writes filtering code that calls <code>web_search()</code>/<code>web_fetch()</code>, each nested pair carrying a <code>caller</code> back to its code-exec parent. A nested hosted call, verbatim:</p>
<pre>${esc(JSON.stringify(s2aNested, null, 2))}</pre>
<h3>4b - forced direct (<code>allowed_callers:["direct"]</code>)</h3>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s2b)}</tbody></table>
<p>No code-exec wrapper - classic <code>server_tool_use:web_search</code> → <code>web_search_tool_result</code> at top level. This is the ZDR-eligible / pre-dynamic-filtering shape.</p>

<h2><span class="n">5</span>response_inclusion:"excluded" - the API filters for you</h2>
<p class="lede">Same dynamic search, but the tool carries <code>response_inclusion:"excluded"</code>.</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s6a)}</tbody></table>
<div class="note win"><b>Confirmed on the wire.</b> Searches were billed (<code>usage.server_tool_use</code>) yet <b>no <code>web_search</code> blocks appear</b> in the response. Only <code>code_execution</code> + its result survive - and that result is <code>encrypted_code_execution_result</code>:</div>
<pre>${esc(JSON.stringify({ type: s6aResult?.content?.type, encrypted_stdout: (s6aResult?.content?.encrypted_stdout || '').slice(0, 90) + '…', has_stderr: !!s6aResult?.content?.stderr }, null, 2))}</pre>
<p><b>Encryption is caused by hosted content, not by <code>excluded</code>.</b> Pure-PTC code results (§2, no web) are plaintext <code>code_execution_result</code>; any code cell that consumed web search/fetch returns <code>encrypted_code_execution_result</code> - in both <code>full</code> and <code>excluded</code> modes.</p>

<h2><span class="n">6</span>Mixing a hosted tool + a client tool in one <em>direct</em> turn</h2>
<p class="lede">No code-exec. <code>web_fetch</code> (basic) + client <code>run_command</code>, asked in parallel.</p>
<table><thead><tr><th>turn</th><th>stop</th><th>content blocks</th><th>usage</th></tr></thead><tbody>${turnRows(s5)}</tbody></table>
<div class="note"><b>Server tool deferred.</b> Turn 0: <code>server_tool_use:web_fetch</code> appears <b>without a result</b>, next to your <code>run_command</code> call, <code>stop_reason:"tool_use"</code>. The hosted fetch does <b>not</b> run yet. You return only the <code>run_command</code> result; the next turn <b>begins</b> with the now-executed <code>web_fetch_tool_result</code>. Detect this state by: a <code>server_tool_use</code> whose <code>id</code> has no matching result block in the same response.</div>

<h2><span class="n">7</span>What can you <em>not</em> pass back? - the retention matrix</h2>
<p class="lede">Take a completed transcript, mutate the history, re-send, observe. 200 = the omission is legal; 400 = mandatory.</p>
<table><thead><tr><th>probe</th><th>result</th><th>what it removed / tested</th><th>error</th></tr></thead><tbody>
${ret.map(retRow).join('')}
<tr><td class="mono">r3_resume_without_container</td><td><span class="bad">400</span></td><td>Resume a live paused PTC turn with no <code>container</code> id</td><td class="mono small">${esc((r3.noCid?.err?.message || 'container_id is required when there are pending tool uses generated by code execution').slice(0,120))}</td></tr>
<tr><td class="mono">r3_resume_without_ce_tool</td><td><span class="ok">200 ${esc(r3.noCE.stop)}</span></td><td>Resume a live paused PTC turn, <code>code_execution</code> tool omitted from <code>tools[]</code></td><td class="mono small muted">no 400 (doc-vs-reality: docs imply this should fail)</td></tr>
</tbody></table>

<div class="grid2">
<div class="note win"><b>Called from code → optional &amp; free.</b><br>• <b>R2</b>: drop all nested PTC <code>tool_use</code>+<code>tool_result</code> → 200, input tokens <b>identical</b>.<br>• <b>R4</b>: drop all nested hosted search/fetch pairs → 200, input tokens <b>identical</b>.<br>⇒ code-exec-nested fragments are neither required nor billed on later turns. The <code>code_execution_tool_result</code> is self-sufficient.</div>
<div class="note"><b>Called first-party → mandatory.</b><br>• <b>R5</b>: delete <code>encrypted_content</code> from a <em>direct</em> <code>web_search</code> result → <b>400</b> "<code>encrypted_content: Field required</code>".<br>• <b>R5b</b>: same turn, intact → 200.<br>⇒ direct hosted results must round-trip verbatim.</div>
</div>
<p><b>Resume requirements for a paused PTC turn:</b> the <kbd>container</kbd> id is <b>mandatory</b> (400 without). The <code>code_execution</code> tool being present in <code>tools[]</code> is <b>not</b> hard-enforced. Note the precise container rule (probed separately): container is required only while a code-exec-called <em>client</em> tool is <b>pending</b> - a completed dynamic-filtering turn replays fine without it.</p>

<h2><span class="n">8</span>The mental model that falls out</h2>
<table><thead><tr><th>axis</th><th>direct / first-party</th><th>called from code execution (dynamic filtering / PTC)</th></tr></thead><tbody>
<tr><td><b>caller field</b></td><td><code>{type:"direct"}</code></td><td><code>{type:"code_execution_20260120", tool_id:"srvtoolu_…"}</code></td></tr>
<tr><td><b>stops the stream?</b></td><td>client tool → yes; hosted tool → no (server loop, maybe <code>pause_turn</code>)</td><td>only when a <b>client</b> function is hit; hosted calls resolve inline</td></tr>
<tr><td><b>serialized in response?</b></td><td>always (hosted result follows its call)</td><td><code>full</code>: nested under code-exec · <code>excluded</code>: dropped</td></tr>
<tr><td><b>required on next turn?</b></td><td><b>yes</b> - verbatim incl. <code>encrypted_content</code> (else 400)</td><td><b>no</b> - droppable, not counted in context</td></tr>
<tr><td><b>in Claude's context?</b></td><td>yes (raw results enter context)</td><td>no - only the final code <code>stdout</code> does</td></tr>
<tr><td><b>result payload</b></td><td>plaintext result block</td><td>code result: plaintext if no web; <code>encrypted_code_execution_result</code> if it touched web</td></tr>
</tbody></table>

<h2><span class="n">R2</span>Token accounting: what actually costs tokens next turn</h2>
<p class="lede">Controlled ablations of a completed transcript, measured by real-inference <code>input_tokens</code> on the follow-up turn. (<code>count_tokens</code> is useless here: it 400s on any server-tool history - <span class="mono small">"Server tools are not supported in the count_tokens endpoint… Use /v1/messages"</span>.)</p>
<div class="grid2">
<div><h3>PTC (custom, no web)</h3><table><thead><tr><th>ablation</th><th>input tok</th><th>legal / answer</th></tr></thead><tbody>${tokByBase('s3_ptc_custom').map(tokRow).join('')}</tbody></table></div>
<div><h3>Dynamic hosted (search in code)</h3><table><thead><tr><th>ablation</th><th>input tok</th><th>legal / answer</th></tr></thead><tbody>${tokByBase('s2a_hosted_dynamic').map(tokRow).join('')}</tbody></table></div>
</div>
<h3>Direct hosted (first-party search)</h3><table><thead><tr><th>ablation</th><th>input tok</th><th>legal / answer</th></tr></thead><tbody>${tokByBase('s2b_hosted_direct').map(tokRow).join('')}</tbody></table>
<div class="note win"><b>The answer to "is the code result alone enough, or do I need the intermediaries?"</b> The intermediaries - nested hosted calls AND your PTC calls/results - are <b>never needed and cost 0 tokens</b> next turn (strip them: identical <code>input_tokens</code>). Keep <em>either</em> the compact code-exec result <em>or</em> just the final assistant text. Only <b>direct</b> hosted results are load-bearing and expensive: one 10-result <code>web_search</code> block ≈ <b>9,400 tok</b> decrypted into context, all-or-nothing.</div>
<div class="note"><b>Directional chain rule.</b> A nested call's <code>caller.tool_id</code> points <em>up</em> to the code-exec parent; nothing points at a leaf. So dropping leaves (nested search/PTC calls) while keeping the parent+result is 200 and free - you only 400 by orphaning a child whose parent is gone. Evict top-down.</div>

<h2><span class="n">R3</span>Serial PTC - one cell resumes in place, model not re-sampled</h2>
<p class="lede">A dependent chain A→B→C→D forced into one <code>while</code> loop. Early turns may show the model fumbling if the tool's return shape surprises its code (a bare string fed to <code>json.loads()</code> crashes the cell). Once correct, <b>one</b> cell <code>${esc(serialCellId)}</code> pauses repeatedly:</p>
<table><thead><tr><th>turn</th><th>stop</th><th>new code cell?</th><th>chain_step token</th></tr></thead><tbody>
${bser.map(t => `<tr><td>${t.turn}</td><td><span class="pill ${t.stop==='tool_use'?'p-pause':'p-end'}">${t.stop}</span></td><td class="mono small">${t.code ? 'id='+t.codeId.slice(-6) : '<span class="muted">- (same cell resumes)</span>'}</td><td class="mono">${(t.tokens||[]).join(',')||'-'}</td></tr>`).join('')}
</tbody></table>
<div class="note win"><b>Resume turns emit no new code and ~0 output tokens</b> - the Python loop state persists across pauses and the model is not re-sampled between steps. The model writes the loop once; the steps are cheap client round-trips. <b>Lesson:</b> a PTC tool must return exactly what the code expects (valid JSON) or it crashes the sandbox cell.</div>

<h2><span class="n">R4</span>Tool Search - and it composes with PTC</h2>
<p class="lede">Deferred tools (<code>defer_loading:true</code>) are discovered on demand, then called.</p>
<div class="note"><b>TS1 (regex):</b> search <code>${esc(JSON.stringify(tsr.ts1.searches))}</code> → discovered + called: <b>${esc(tsr.ts1.discoveredCalls.map(c=>c.name+'/'+c.caller).join(', '))}</b>. Discovered tools are plain client <code>tool_use</code>.</div>
<div class="note win"><b>TS2 (bm25 + code exec):</b> search <code>${esc(JSON.stringify(tsr.ts2.searches))}</code> → discovered the deferred, code-exec-callable <code>lookup_metric</code> → called it <b>from code</b>: ${esc(tsr.ts2.discoveredCalls.map(c=>c.caller).join(', '))}. Giant catalog + search + PTC fan-out all stack.</div>

<h2><span class="n">R5</span>Constraint 400s (the hard edges)</h2>
<table><thead><tr><th>you did</th><th>status</th><th>API said</th></tr></thead><tbody>
${pr2.map(csRow).join('')}
</tbody></table>
<p><code>allowed_callers</code> is model guidance, not a security boundary - handle a stray direct call for any tool you define. Full decision rules + loop skeleton: <code>kb/modules/AIX-anthropic-agentic-loop.md</code>.</p>

<div class="foot">Live capture · direct <code>fetch()</code> streaming against api.anthropic.com · harness at <code>tools/develop/aix-anthropic-eviscerate/</code> (re-run: <code>node run.mjs && node retention.mjs && node r3clean.mjs && node tokacct.mjs && node probes2.mjs && node toolsearch.mjs && node bserial2.mjs && node report.mjs</code>). Generated from the captured JSON - every block sequence, code snippet, and token count above is verbatim from the wire.</div>
</div>`;

fs.writeFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'report.html'), html);
console.log('wrote report.html (' + html.length + ' bytes)');
