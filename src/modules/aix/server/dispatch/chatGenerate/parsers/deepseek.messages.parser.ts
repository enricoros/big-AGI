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
};

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


function _endWith(pt: IParticleTransmitter, issue: ParticleDialectIssue): void {
  pt.addDialectIssue(issue, 'srv-warn');
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
