// Posts what a job found broken to a Discord webhook: once per finding when it appears, and once when it is gone.
// Started by jobs.sh after each job, when JOBS_DISCORD_WEBHOOK_URL is set:
//   node tools/jobs/jobs.notify.mjs <job> <exit status> <findings file>
//
// The findings file has one line per finding, "<severity>\t<subject>: <text>", written by failOn (jobs.shared.ts).
// Only the 'breaks' lines are posted, never 'drift'. A job that failed without writing a line did not get to report:
// that is posted too. What is open is remembered beside the findings file, in <job>.posted, one "<first seen>\t<line>"
// per finding, so a finding that stays is not repeated and its resolution can say how long it lasted.
// A run posts nothing when nothing changed: one message when something breaks, one when it is fixed.

import fs from 'node:fs';
import os from 'node:os';

const [, , job, exitStatus, findingsFile] = process.argv;
const webhookUrl = process.env.JOBS_DISCORD_WEBHOOK_URL;
if (!job || !findingsFile || !webhookUrl) {
  console.error('usage: JOBS_DISCORD_WEBHOOK_URL=... node tools/jobs/jobs.notify.mjs <job> <exit status> <findings file>');
  process.exit(2);
}

const COLOR_BROKEN = 0xED4245;
const COLOR_FIXED = 0x57F287;
const MAX_DESCRIPTION = 3800; // the embed limit is 4096
const MAX_FINDINGS_SHOWN = 12;

const postedFile = findingsFile.replace(/\.findings$/, '') + '.posted';
const linesOf = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(Boolean) : [];

// a key has no place in a channel, and vendors sometimes echo one in an error
const redact = (text) => text
  .replace(/\b(Bearer\s+)\S+/gi, '$1<redacted>')
  .replace(/\b(sk-|sk_|pk-|rk-|nvapi-|gsk_|xai-|fish_|phc_|phx_|AKIA|ABSK|AIza)[A-Za-z0-9_\-+/=]{8,}/g, '$1<redacted>');


// --- what is open now, what was open before ---

const found = linesOf(findingsFile).map(line => line.split('\t'));
let open = [...new Set(found.filter(([severity]) => severity === 'breaks').map(([, text]) => redact(text ?? '')))];
if (exitStatus !== '0' && !found.length)
  open = [`${job}: the job failed before it could report anything, see its log on ${os.hostname()}`];

const now = new Date();
const before = new Map(linesOf(postedFile).map(line => {
  const [first, ...rest] = line.split('\t');
  return rest.length ? [rest.join('\t'), first] : [line, ''];  // older state files had the text alone
}));

const appeared = open.filter(line => !before.has(line));
const fixed = [...before.keys()].filter(line => !open.includes(line));
const stillOpen = open.filter(line => before.has(line));


// --- how a finding reads ---

/** "mistral: [OpenAI/Mistral issue]: Upstream responded with HTTP 401 : {...} (3 attempts)" -> its parts */
function parse(line) {
  const split = line.indexOf(': ');
  const subject = split > 0 && split < 40 ? line.slice(0, split) : job;
  let text = split > 0 && split < 40 ? line.slice(split + 2) : line;
  const attempts = text.match(/\((\d+) attempts\)\s*$/)?.[1];
  if (attempts) text = text.replace(/\s*\(\d+ attempts\)\s*$/, '');
  const status = text.match(/\bHTTP (\d{3})\b/)?.[1];
  const detail = text.match(/"(?:detail|message|error_description)"\s*:\s*"([^"]{1,160})"/)?.[1];
  const raw = text.replace(/^\[[^\]]{1,60}\]:\s*/, '').replace(/\s+/g, ' ').trim();
  const headline = status ? `HTTP ${status}${detail ? ` - ${detail}` : ''}` : raw.length > 120 ? `${raw.slice(0, 117)}...` : raw;
  // the vendor's text in full, where the headline had to leave something out
  const rest = (status && detail) || raw.length <= 120 ? '' : raw;
  return { subject, headline, rest, attempts };
}

const clock = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '';

function lasted(iso) {
  if (!iso) return '';
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  return minutes < 90 ? `${minutes} min` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} days`;
}

function brokenBlock(line) {
  const { subject, headline, rest, attempts } = parse(line);
  return `**${subject}** - ${headline}`
    + (rest ? `\n\`\`\`\n${rest.slice(0, 400)}\n\`\`\`` : '')
    + (attempts ? `\n_failed ${attempts} times in a row_` : '');
}

function fixedBlock(line) {
  const { subject, headline } = parse(line);
  const since = before.get(line);
  return `**${subject}** - was: ${headline}${since ? `\n_broken for ${lasted(since)}, since ${clock(since)}_` : ''}`;
}

function listOf(lines, block) {
  const shown = lines.slice(0, MAX_FINDINGS_SHOWN).map(block).join('\n\n');
  const more = lines.length > MAX_FINDINGS_SHOWN ? `\n\n_...and ${lines.length - MAX_FINDINGS_SHOWN} more, see the log_` : '';
  const text = shown + more;
  return text.length > MAX_DESCRIPTION ? `${text.slice(0, MAX_DESCRIPTION)}\n...` : text;
}

const footer = { text: `${job} on ${os.hostname()}` };
const embeds = [];
if (appeared.length)
  embeds.push({
    color: COLOR_BROKEN,
    title: `🚨 ${appeared.length === 1 ? 'Something broke' : `${appeared.length} things broke`}`,
    description: listOf(appeared, brokenBlock),
    ...(stillOpen.length && { fields: [{ name: 'Still broken', value: stillOpen.map(line => parse(line).subject).join(', ').slice(0, 1000) }] }),
    footer, timestamp: now.toISOString(),
  });
if (fixed.length)
  embeds.push({
    color: COLOR_FIXED,
    title: `✅ ${open.length ? `Fixed (${fixed.length})` : 'Back to normal'}`,
    description: listOf(fixed, fixedBlock),
    footer, timestamp: now.toISOString(),
  });


// --- post, then remember ---

if (embeds.length) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds, allowed_mentions: { parse: [] } }), // text that comes from a vendor never pings anyone
  });
  if (!response.ok) {
    // the state is left as it was, so the next run posts the same change again
    console.error(`notify: the webhook answered HTTP ${response.status} for ${job}`);
    process.exit(1);
  }
  console.log(`notify: posted ${[appeared.length && `${appeared.length} broken`, fixed.length && `${fixed.length} fixed`].filter(Boolean).join(', ')} for ${job}`);
}

fs.writeFileSync(postedFile, open.map(line => `${before.get(line) || now.toISOString()}\t${line}\n`).join(''));
