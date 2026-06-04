import { DMessage, messageFragmentsReduceText } from './chat.message';
import { isVoidThinkingFragment } from './chat.fragments';


// configuration
const _CHARS_PER_TOKEN = 4; // rough cross-vendor heuristic to bring provider-reported token counts onto the character scale used for text


/**
 * Full, debuggable size breakdown of a generated message, normalized to a character-equivalent scale.
 *
 * Reasoning is represented very differently per vendor, so we collect every available signal and then pick the
 * most reliable one for ranking:
 *  - reported reasoning tokens (TOutR) - authoritative when present; converted to chars (x CHARS_PER_TOKEN)
 *  - encrypted/redacted reasoning blobs - Anthropic redactedData + textSignature, OpenAI/xAI reasoningItem
 *    .encryptedContent, Gemini thoughtSignature; base64, so decoded bytes (x3/4) proxy the real reasoning size
 *  - plain reasoning text (aText) - last resort; for Gemini/Anthropic this is usually a summary or a fixed
 *    placeholder (e.g. "I'm planning right now"), so it badly under-represents real thinking
 *
 * text is measured directly from content fragments (reliable); total = text + chosen reasoning.
 */
export interface MsgMeasureSizes {
  // ranking dimensions (character-equivalent)
  overall: number;
  text: number;
  thinking: number;

  // raw signals (for debug tables / benchmarking)
  textChars: number;             // readable answer characters
  reasoningTextChars: number;    // 'ma' aText characters (often summary / fixed placeholder)
  reasoningEncBytes: number;     // decoded bytes of all base64 encrypted/redacted reasoning blobs
  reportedTokOut?: number;       // generator.metrics.TOut (provider tokens)
  reportedTokReasoning?: number; // generator.metrics.TOutR (provider tokens)

  // provenance of the chosen reasoning magnitude
  reasoningSource: MsgMeasureSource;
  reasoningWhy: string;
}

// which signal the chosen reasoning magnitude came from
export type MsgMeasureSource = 'reported-tokens' | 'encrypted' | 'text' | 'none';


const _EMPTY_DETAIL: MsgMeasureSizes = {
  overall: 0, text: 0, thinking: 0,
  textChars: 0, reasoningTextChars: 0, reasoningEncBytes: 0,
  reasoningSource: 'none', reasoningWhy: 'no message',
};


export function messageMeasureSizes(message: DMessage | undefined): MsgMeasureSizes {
  if (!message) return _EMPTY_DETAIL;

  const metrics = message.generator?.metrics;
  const reportedTokOut = metrics?.TOut;
  const reportedTokReasoning = metrics?.TOutR;

  // text: readable answer characters (messageFragmentsReduceText already excludes void/reasoning fragments)
  const textChars = messageFragmentsReduceText(message.fragments, '\n\n', false).length;

  // reasoning signals, collected across all fragments and vendors
  let reasoningTextChars = 0;
  let reasoningEncBytes = 0;
  for (const fragment of message.fragments) {
    // 'ma' reasoning void fragments: readable aText + Anthropic signature / redacted blocks
    if (isVoidThinkingFragment(fragment)) {
      reasoningTextChars += fragment.part.aText.length;
      if (fragment.part.textSignature)
        reasoningEncBytes += _b64ApproxBytes(fragment.part.textSignature);
      if (fragment.part.redactedData)
        for (const blob of fragment.part.redactedData)
          reasoningEncBytes += _b64ApproxBytes(blob);
    }
    // per-fragment vendor reasoning sidecars (opaque/encrypted): Gemini signature, OpenAI/xAI reasoning items
    const vs = 'vendorState' in fragment ? fragment.vendorState : undefined;
    if (vs) {
      if (vs.gemini?.thoughtSignature)
        reasoningEncBytes += _b64ApproxBytes(vs.gemini.thoughtSignature);
      if (vs.openai?.reasoningItem?.encryptedContent)
        reasoningEncBytes += _b64ApproxBytes(vs.openai.reasoningItem.encryptedContent);
      if (vs.xai?.reasoningItem?.encryptedContent)
        reasoningEncBytes += _b64ApproxBytes(vs.xai.reasoningItem.encryptedContent);
      // NOTE: add more in the future if we have vendor state on a Fragment which contains reasoning
    }
  }

  // choose the reasoning magnitude (character-equivalent), most-reliable signal first
  let thinking: number;
  let reasoningSource: MsgMeasureSource;
  let reasoningWhy: string;
  if (reportedTokReasoning != null && reportedTokReasoning > 0) {
    thinking = reportedTokReasoning * _CHARS_PER_TOKEN;
    reasoningSource = 'reported-tokens';
    reasoningWhy = `provider reasoning tokens (TOutR=${reportedTokReasoning}) x${_CHARS_PER_TOKEN}`;
  } else if (reasoningEncBytes > 0) {
    thinking = reasoningEncBytes;
    reasoningSource = 'encrypted';
    reasoningWhy = `decoded encrypted reasoning (~${reasoningEncBytes} bytes)`;
  } else if (reasoningTextChars > 0) {
    thinking = reasoningTextChars;
    reasoningSource = 'text';
    reasoningWhy = 'reasoning text length (likely summary/placeholder)';
  } else {
    thinking = 0;
    reasoningSource = 'none';
    reasoningWhy = 'no reasoning detected';
  }

  const text = textChars;
  const overall = text + thinking;
  return {
    overall, text, thinking,
    textChars, reasoningTextChars, reasoningEncBytes,
    reportedTokOut, reportedTokReasoning,
    reasoningSource, reasoningWhy,
  };
}

// base64 decodes 3 bytes per 4 characters (padding ignored - this is an estimate)
function _b64ApproxBytes(b64: string): number {
  return Math.floor(b64.length * 3 / 4);
}
