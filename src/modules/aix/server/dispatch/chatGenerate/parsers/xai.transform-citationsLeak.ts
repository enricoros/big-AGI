/**
 * xAI web_search citation-directive leak filter.
 *
 * grok-4.6 (2/2 repro on 2026-08-13; grok-4.5 clean on the byte-identical request) can leak an
 * internal citation directive into the user-visible output_text of web_search answers, in two forms:
 *
 *   A. 'render_inline_citation<citation_id>10</citation_id>'            (plain ASCII)
 *   B. '\uE200render_inline_citation?citation_id=10\u0003'              (PUA sentinel + ETX framing)
 *
 * The model has a working citation path elsewhere (x_search answers emit '[[1]](url)' markdown with
 * real annotations), so this is the internal directive failing open on the web_search path.
 * We strip exactly the observed grammar. xAI streams per-token deltas, so a marker always spans
 * several deltas: the streaming filter holds back text only while a marker could still be forming.
 */

const _LEAK_LITERAL = 'render_inline_citation';

// bounds the viability scan: U+E200(1) + literal(22) + '<citation_id>'(13) + digits(<=10) + '</citation_id>'(14)
const _LEAK_MAX_SPAN = 64;

// complete markers: form A self-terminates; form B terminates on ETX or is definitively over at the first non-digit
// digit runs are capped at 10 to match the streaming viability check (longer runs are not our marker, in either path)
// eslint-disable-next-line no-control-regex
const _LEAK_COMPLETE_RE = /\uE200?render_inline_citation(?:<citation_id>\d{1,10}<\/citation_id>|\?citation_id=\d{1,10}(?:\u0003|(?=[^\d\u0003])))/g;

// partial marker at end-of-text (truncated leak), or a trailing bare PUA sentinel
// eslint-disable-next-line no-control-regex
const _LEAK_TRAILING_RE = /(?:\uE200?render_inline_citation(?:<citation_id>\d{0,10}(?:<\/citation_id>)?|\?citation_id=\d{0,10}\u0003?)?|\uE200)$/;


/** One-shot strip for full (non-streaming) text. */
export function stripXAIDefectiveCitations(text: string): string {
  if (!text || (!text.includes(_LEAK_LITERAL) && !text.includes('\uE200')))
    return text;
  return text.replace(_LEAK_COMPLETE_RE, '').replace(_LEAK_TRAILING_RE, '');
}


/**
 * Streaming variant: strips complete markers and holds back the shortest tail that could still
 * grow into one. flush() at part end decides the fate of any remainder.
 */
export class XAIDefectiveCitationsFilter {

  #held: string = '';

  /** Returns the text safe to emit now - possibly '' while a marker may be forming. */
  streamingDelta(textDelta: string): string {
    let text = this.#held + textDelta;
    this.#held = '';
    if (text.includes(_LEAK_LITERAL) || text.includes('\uE200'))
      text = text.replace(_LEAK_COMPLETE_RE, '');
    const holdFrom = _findHoldbackStart(text);
    if (holdFrom < text.length) {
      this.#held = text.substring(holdFrom);
      text = text.substring(0, holdFrom);
    }
    return text;
  }

  /** Releases text held at part end. The held text is a viable marker prefix by construction. */
  flush(): string {
    const held = this.#held;
    this.#held = '';
    if (!held) return '';
    // PUA-framed or full-literal prefixes are certainly the leak - drop; shorter bare partials
    // (e.g. a message genuinely ending in 'render') are likely prose - emit
    if (held.charCodeAt(0) === 0xE200 || held.startsWith(_LEAK_LITERAL))
      return '';
    return held;
  }

}


/** Index of the earliest still-viable marker start near the end of the text, or text.length if none. */
function _findHoldbackStart(text: string): number {
  for (let i = Math.max(0, text.length - _LEAK_MAX_SPAN); i < text.length; i++) {
    const c = text[i];
    if ((c === 'r' || c === '\uE200') && _isViableLeakPrefix(text.substring(i)))
      return i;
  }
  return text.length;
}

/** Whether s could still grow into a complete marker (every char so far fits the grammar). */
function _isViableLeakPrefix(s: string): boolean {
  let i = 0;
  if (s.charCodeAt(0) === 0xE200) {
    if (s.length === 1) return true;
    i = 1;
  }
  const litPart = s.substring(i, i + _LEAK_LITERAL.length);
  if (litPart.length < _LEAK_LITERAL.length)
    return _LEAK_LITERAL.startsWith(litPart);
  if (litPart !== _LEAK_LITERAL)
    return false;
  const tail = s.substring(i + _LEAK_LITERAL.length);
  return !tail || _isViableTail(tail, '<citation_id>', '</citation_id>') || _isViableTail(tail, '?citation_id=', '\u0003');
}

/** Grammar-prefix check for the post-literal tail: open + digits + close. */
function _isViableTail(tail: string, open: string, close: string): boolean {
  if (tail.length <= open.length)
    return open.startsWith(tail);
  if (!tail.startsWith(open))
    return false;
  let d = open.length;
  while (d < tail.length && tail[d] >= '0' && tail[d] <= '9') d++;
  const digits = d - open.length;
  if (digits > 10) return false; // unbounded digit run - not our marker
  if (d === tail.length) return true; // still in (or awaiting) digits
  if (!digits) return false; // close cannot start before any digit
  const rest = tail.substring(d);
  // a full close would already have been stripped as a complete marker - only a proper prefix keeps viability
  return rest.length < close.length && close.startsWith(rest);
}
