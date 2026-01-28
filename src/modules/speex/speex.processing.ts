/**
 * Text processing utilities for TTS synthesis.
 *
 * - Preprocessing: removes code blocks, cleans URLs, strips attachments
 * - Chunking: splits large text into smaller chunks for progressive synthesis
 */

import { speexGetTtsCharLimit } from './store-module-speex';


// --- Text Preprocessing ---

export function speex_textApplyCharLimit(inputText: string): string {
  const charLimit = speexGetTtsCharLimit();
  const truncated = charLimit !== null && inputText.length > charLimit;
  const text = !truncated ? inputText : inputText.slice(0, charLimit);
  if (truncated)
    console.log(`[Speex] Text truncated from ${inputText.length} to ${charLimit} characters`);
  return text;
}

/**
 * Preprocesses text for TTS to remove elements that shouldn't be spoken. #741
 */
export function speex_textCleanupUnspoken(inputText: string): string {
  let text = inputText;

  // Remove code blocks (```...```) including mermaid, sql, csv, etc.
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove standalone HTML/SVG blocks
  text = text.replace(/<!DOCTYPE html>[\s\S]*?<\/html>/gi, '');
  text = text.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Remove attachment references (markdown images)
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, '');

  // Clean URLs - remove http:// and https:// prefixes for natural speech
  text = text.replace(/https?:\/\//gi, '');

  // Clean up excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/\s{3,}/g, ' ');

  return text.trim();
}


// --- Text Chunking ---


/**
 * Splits text into chunks for progressive TTS synthesis.
 *
 * Strategy (in order of preference):
 * 1. Split by paragraphs (double newline)
 * 2. If paragraph > maxLength, split by sentences (. ! ?)
 * 3. If sentence > maxLength, split by single newline
 * 4. If still > maxLength, split at word boundaries
 *
 * @param text - The full text to split
 * @param maxChunkLength - Maximum characters per chunk (default: 500)
 * @returns Array of text chunks, preserving order
 */
export function speex_splitTextIntoChunks(text: string, maxChunkLength: number = 500): string[] {
  if (!text?.trim()) return [];

  // start with paragraphs (double newline or more)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChunkLength) {
      // Paragraph too long - split into sentences
      chunks.push(..._splitParagraphIntoChunks(paragraph, maxChunkLength));
    } else
      chunks.push(paragraph);
  }

  return chunks;
}

function _splitParagraphIntoChunks(paragraph: string, fitWithinMaxLength: number): string[] {
  // split by sentence endings (. ! ?) followed by space or end
  const sentences = paragraph.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);

  const chunks: string[] = [];

  for (const sentence of sentences) {
    if (sentence.length > fitWithinMaxLength) {
      // Sentence too long - try splitting by single newlines
      const lines = sentence.split(/\n/).map(l => l.trim()).filter(Boolean);

      for (const line of lines) {
        if (line.length > fitWithinMaxLength) {
          // Line too long - split at word boundaries
          chunks.push(..._splitAtWordBoundaries(line, fitWithinMaxLength));
        } else
          chunks.push(line);
      }
    } else
      chunks.push(sentence);
  }

  return chunks;
}

function _splitAtWordBoundaries(text: string, fitWithinMaxLength: number): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    // if single word exceeds maxLength, we have to include it anyway
    if (word.length > fitWithinMaxLength) {
      if (current) {
        chunks.push(current.trim());
        current = '';
      }
      chunks.push(word);
      continue;
    }

    const tentative = current ? `${current} ${word}` : word;

    if (tentative.length > fitWithinMaxLength) {
      if (current) chunks.push(current.trim());
      current = word;
    } else
      current = tentative;
  }

  if (current) chunks.push(current.trim());
  return chunks;
}
