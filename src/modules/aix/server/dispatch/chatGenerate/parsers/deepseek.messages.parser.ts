import { safeErrorString } from '~/server/wire';

import type { ChatGenerateParseFunction } from '../chatGenerate.dispatch';
import type { IParticleTransmitter, ParticleDialectIssue } from './IParticleTransmitter';

import { type AnthropicParserPlugin, createAnthropicMessageParser, createAnthropicMessageParserNS } from './anthropic.parser';


/**
 * [DeepSeek Messages] DeepSeek's responses on its Anthropic-compatible wire.
 *
 * The parser is Anthropic's, with DeepSeek's own additions plugged in (AnthropicParserPlugin) and, around it, the two
 * endings only this vendor has. Measured on api.deepseek.com, 2026-11-25: kb/modules/LLM-deepseek-messages.md
 */

/**
 * A thinking block's `signature` is a UUID here: it signs nothing and the vendor does not check it on the way back. Not
 * stored, so that DeepSeek reasoning is plain text on either wire and no such value is later replayed to Anthropic.
 */
const _PLUGIN: AnthropicParserPlugin = {
  dropThinkingSignatures: true,
  onServerToolUse: _showWebTool,
};

/**
 * The web tools' calls. One `server_tool_use` per step, complete when it starts, its `input.action` saying which:
 * `search` (several queries in one call; none on an image search, where the image is the query), `open_page` and
 * `find_in_page` (a deep search working through its results), `read_link` (a link of the user's message).
 * Their results are Anthropic's `web_search_tool_result` and `web_fetch_tool_result`, which the parser closes by id.
 */
function _showWebTool(pt: IParticleTransmitter, block: Parameters<NonNullable<AnthropicParserPlugin['onServerToolUse']>>[1], op: { opId: string, parentOpId?: string }): boolean {
  if (block.name !== 'deepseek_web_search' && block.name !== 'deepseek_read_url')
    return false;

  const { action, queries, url, pattern } = _webToolInput(block.input);
  switch (action) {
    case 'search':
      pt.sendOperationState('search-web', block.kind?.includes('image') ? 'Searching by image...' : 'Searching the web...', { ...op, iTexts: queries.map(query => `Search query: "${query}"`) });
      break;
    case 'open_page':
    case 'read_link':
      pt.sendOperationState('search-web', `Fetching ${url || 'web content'}...`, { ...op, ...(url ? { iTexts: [`URL: ${url}`] } : {}) });
      break;
    case 'find_in_page':
      pt.sendOperationState('search-web', `Finding "${pattern ?? ''}" in ${url || 'the page'}...`, { ...op, ...(pattern ? { iTexts: [`pattern: ${pattern}`] } : {}) });
      break;
    default:
      pt.sendOperationState('search-web', 'Using the web...', op); // an action added since: shown, and closed by its result as the others
      break;
  }
  return true;
}

/** The input is the object non-streaming, and its JSON as a string when streaming: the Anthropic parser keeps a started block's input as text */
function _webToolInput(input: unknown): { action?: string, queries: string[], url?: string, pattern?: string } {
  let value = input;
  if (typeof value === 'string')
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  const fields: Record<string, unknown> = (value && typeof value === 'object') ? value as Record<string, unknown> : {};
  const text = (field: unknown) => typeof field === 'string' ? field : undefined;
  return {
    action: text(fields.action),
    queries: Array.isArray(fields.queries) ? fields.queries.filter((query): query is string => typeof query === 'string') : [],
    url: text(fields.url),
    pattern: text(fields.pattern),
  };
}

/**
 * Pings in a row, about 15 seconds apart, that end a stream. A stalled stream is HTTP 200, `message_start`, then pings
 * for as long as the client stays (1 seen in 4,400 requests, held for 7 minutes); a stream that completes was never
 * seen to ping twice in a row (553 of 553, runs of up to 23 seconds of hosted tools included).
 */
const STALL_PINGS = 8;
const STALL_ISSUE: ParticleDialectIssue = { text: 'No content for 2 minutes, keep-alive pings only: stopped waiting.' };


export function createDeepseekMessagesParser(streaming: boolean): ChatGenerateParseFunction {
  const parse = (streaming ? createAnthropicMessageParser : createAnthropicMessageParserNS)(undefined, _PLUGIN);
  let pingsInARow = 0;

  return function(pt, eventData, eventName, context): void {

    if (!streaming) {
      // a generation that fails is still an HTTP 200: the body is the error, not a message
      const failure = _errorIssueOf(eventData, true);
      return failure ? _endWith(pt, failure) : parse(pt, eventData, eventName, context);
    }

    if (eventName !== 'ping')
      pingsInARow = 0;
    else if (++pingsInARow >= STALL_PINGS)
      return _endWith(pt, STALL_ISSUE);

    // the generation never started: one frame with no event name and no `type`, then the vendor closes. Not retried,
    // the vendor's own wait is over by then
    if (eventName === undefined) {
      const failure = _errorIssueOf(eventData, false);
      if (failure)
        return _endWith(pt, failure);
    }

    parse(pt, eventData, eventName, context);
  };
}


/** All three endings are the vendor's (a failed generation, a start that timed out, a stall), never our request: logged, not warned */
function _endWith(pt: IParticleTransmitter, issue: ParticleDialectIssue): void {
  pt.addDialectIssue(issue, 'srv-log');
  pt.setDialectEnded('issue-dialect');
}

/** The vendor's words when the payload is an error and not a message or an event: `{ error }`, typed 'error' or not typed at all */
function _errorIssueOf(data: string, acceptTyped: boolean): ParticleDialectIssue | null {
  let payload: any;
  try {
    payload = JSON.parse(data);
  } catch {
    return null; // not ours to explain: the parser reports it
  }
  const error = payload?.error;
  if (!error || !(payload.type === undefined || (acceptTyped && payload.type === 'error')))
    return null;
  const causeCode = typeof error.type === 'string' && error.type ? error.type : typeof error.code === 'string' && error.code ? error.code : undefined;
  return typeof error.message === 'string' && error.message
    ? { text: error.message, causeCode }
    : { detail: safeErrorString(error) || undefined, causeCode };
}
