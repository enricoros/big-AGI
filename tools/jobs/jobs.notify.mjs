// Posts what a job found broken to a Discord webhook: once per finding, and once more when the job is back to
// normal. Started by jobs.sh after each job, when JOBS_DISCORD_WEBHOOK_URL is set:
//   node tools/jobs/jobs.notify.mjs <job> <exit status> <findings file>
//
// The findings file has one line per finding, "<severity>\t<text>", written by failOn (jobs.shared.ts). Only the
// 'breaks' lines are posted, never 'drift'. A job that failed without writing a line did not get to report: that is
// posted too. What was posted is remembered beside the findings file, in <job>.posted, so a finding that stays is
// not repeated.

import fs from 'node:fs';
import os from 'node:os';

const [, , job, exitStatus, findingsFile] = process.argv;
const webhookUrl = process.env.JOBS_DISCORD_WEBHOOK_URL;
if (!job || !findingsFile || !webhookUrl) {
  console.error('usage: JOBS_DISCORD_WEBHOOK_URL=... node tools/jobs/jobs.notify.mjs <job> <exit status> <findings file>');
  process.exit(2);
}

const DISCORD_MAX_CHARS = 1900; // the limit is 2000

const postedFile = findingsFile.replace(/\.findings$/, '') + '.posted';
const linesOf = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').map(line => line.trim()).filter(Boolean) : [];

// a key has no place in a channel, and vendors sometimes echo one in an error
const redact = (text) => text
  .replace(/\b(Bearer\s+)\S+/gi, '$1<redacted>')
  .replace(/\b(sk-|sk_|pk-|rk-|nvapi-|gsk_|xai-|fish_|phc_|phx_|AKIA|ABSK|AIza)[A-Za-z0-9_\-+/=]{8,}/g, '$1<redacted>');

const found = linesOf(findingsFile).map(line => line.split('\t'));
let breaks = [...new Set(found.filter(([severity]) => severity === 'breaks').map(([, text]) => redact(text ?? '')))];
if (exitStatus !== '0' && !found.length)
  breaks = ['the job failed before it could report anything: see its log'];

const posted = linesOf(postedFile);
const fresh = breaks.filter(line => !posted.includes(line));
const backToNormal = posted.length > 0 && !breaks.length;

const where = `on ${os.hostname()}`;
const content = fresh.length ? `**${job}**: ${fresh.length === 1 ? '1 new problem' : `${fresh.length} new problems`} (${where})\n${fresh.map(line => `- ${line}`).join('\n')}`
  : backToNormal ? `**${job}**: back to normal (${where})`
    : '';

if (content) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: content.length > DISCORD_MAX_CHARS ? `${content.slice(0, DISCORD_MAX_CHARS)}\n...` : content,
      allowed_mentions: { parse: [] }, // text that comes from a vendor never pings anyone
    }),
  });
  if (!response.ok) {
    // nothing is remembered as posted, so the next run tries again
    console.error(`notify: the webhook answered HTTP ${response.status} for ${job}`);
    process.exit(1);
  }
  console.log(`notify: posted ${fresh.length ? `${fresh.length} new problem(s)` : 'back to normal'} for ${job}`);
}

fs.writeFileSync(postedFile, breaks.map(line => `${line}\n`).join(''));
