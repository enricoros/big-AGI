import { fileSave } from 'browser-fs-access';

import type { DConversation } from '~/common/stores/chat/chat.conversation';
import type { DMessage } from '~/common/stores/chat/chat.message';
import type { DMessageFragment, DMessageImageRefPart, DMessageZyncAssetReferencePart, DVoidWebCitation } from '~/common/stores/chat/chat.fragments';
import type { Immutable } from '~/common/types/immutable.types';
import { aixConvertImageRefToInlineImageOrThrow, aixConvertZyncImageAssetRefToInlineImageOrThrow } from '~/modules/aix/client/aix.client.chatGenerateRequest';
import { attachmentFragmentDocTitle, isZyncAssetImageReferencePart, isZyncAssetReferencePart } from '~/common/stores/chat/chat.fragments';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';
import { createZipBlob, ZipEntry } from '~/common/util/zipUtils';
import { prettyShortChatModelName } from '~/common/util/dMessageUtils';


// Claude Code session (transcript) shape, as written by Claude Code 2.1.296 and resumed with `claude --resume <file.jsonl>`
const CC_VERSION = '2.1.296';
const CC_CWD = '/big-agi'; // informational: a transcript resumed by path runs in the caller's folder
const CC_ASSISTANT_MODEL = '<synthetic>'; // Claude Code's own marker for non-API turns: kept in context, zero usage ignored

// chat folder layout, stamped in chat.md for future readers/importers
const FOLDER_SCHEMA = 'vnd.agi.chat-folder';
const FOLDER_SCHEMA_VERSION = 1;
const FOLDER_TITLE_MAX_CHARS = 40;

// chat.agi.json keeps the fields of the per-chat JSON export (any app version), in the schema-less shape every importer accepts
const CHAT_JSON_FIELDS = ['id', 'messages', 'userTitle', 'autoTitle', 'systemPurposeId', 'branchedFromId', 'branchedUntilMessageId', 'created', 'updated'];


/**
 * Chat export for Claude Code:
 * - 'session': a Claude Code transcript (.jsonl), resumable with `claude --resume <file>`
 * - 'folder': a zip holding one per-chat folder - chat.md, images/, chat.agi.json (Big-AGI importable), and optionally the session.
 *   The folder name is stable per chat ('YYYY-MM-DD-title-id8'), so exports of different chats extract side by side.
 *
 * Resilience: data from older or newer app versions degrades per fragment (a placeholder line), never failing the export.
 */
export namespace ClaudeCodeExport {

  export type Format = 'session' | 'folder';

  export type Options = {
    includeImages: boolean;
    includeSystemPrompt: boolean;
    includeSessionInFolder: boolean;
  };

  /** What the chat holds that the options act on - shown before exporting */
  export type ContentSummary = {
    imageCount: number;
    imageBytes: number;
    hasSystemPrompt: boolean;
  };

  export type Saved = {
    fileName: string;
    resumePath: string | null; // relative to where the file or the extracted folder lands
  };


  export function summarizeContent(conversation: Immutable<DConversation>): ContentSummary {
    let imageCount = 0;
    let imageBytes = 0;
    for (const message of conversation.messages)
      for (const fragment of message.fragments) {
        if (fragment.ft !== 'content' && fragment.ft !== 'attachment') continue;
        const part = fragment.part;
        const dataRef = part?.pt === 'image_ref' ? part.dataRef
          : part?.pt === 'reference' && isZyncAssetImageReferencePart(part) ? part._legacyImageRefPart?.dataRef
            : null;
        if (dataRef === null) continue;
        imageCount++;
        if (dataRef?.reftype === 'dblob') imageBytes += dataRef.bytesSize || 0;
      }
    const hasSystemPrompt = conversation.messages.some(message => message.role === 'system' && _messageText(message).trim().length > 0);
    return { imageCount, imageBytes, hasSystemPrompt };
  }

  /**
   * Builds the export and saves it (save dialog where available).
   * @throws {DOMException} AbortError if the user closes the save dialog
   */
  export async function downloadOrThrow(conversation: Immutable<DConversation>, format: Format, options: Options): Promise<Saved> {
    const title = conversation.userTitle || conversation.autoTitle || 'Untitled chat';
    const folderName = _folderName(conversation);
    const turns = await _lowerConversation(conversation, options.includeImages);

    if (format === 'session') {
      const fileName = `${folderName}.claude.jsonl`;
      const jsonl = _renderSessionJsonl(conversation, title, turns, options.includeSystemPrompt);
      await fileSave(new Blob([jsonl], { type: 'application/x-ndjson' }), { fileName, extensions: ['.jsonl'] });
      return { fileName, resumePath: fileName };
    }

    const entries: ZipEntry[] = [
      { path: `${folderName}/chat.md`, data: _renderChatMarkdown(conversation, title, turns, options.includeSystemPrompt) },
      { path: `${folderName}/chat.agi.json`, data: JSON.stringify(_conversationAtRest(conversation), null, 2) },
    ];
    if (options.includeSessionInFolder)
      entries.push({ path: `${folderName}/session.claude.jsonl`, data: _renderSessionJsonl(conversation, title, turns, options.includeSystemPrompt) });
    for (const turn of turns)
      for (const block of turn.blocks)
        if (block.bt === 'image')
          entries.push({ path: `${folderName}/images/${block.fileName}`, data: convert_Base64_To_UInt8Array(block.base64, 'ClaudeCodeExport') });

    const fileName = `${folderName}.zip`;
    await fileSave(createZipBlob(entries), { fileName, extensions: ['.zip'] });
    return { fileName, resumePath: options.includeSessionInFolder ? `${folderName}/session.claude.jsonl` : null };
  }

}


/// Lowering: DMessage[] -> turns of exportable blocks, shared by all formats

type _ExportBlock =
  | { bt: 'text', text: string }
  | { bt: 'doc', title: string, ref: string, text: string, language?: string }
  | { bt: 'image', mimeType: string, base64: string, fileName: string, altText: string };

type _ExportTurn = {
  message: Immutable<DMessage>;
  skipped: boolean;   // excluded from the AI context
  isNote: boolean;    // user note (always skipped)
  modelLabel?: string;
  blocks: _ExportBlock[];
};

async function _lowerConversation(conversation: Immutable<DConversation>, includeImages: boolean): Promise<_ExportTurn[]> {
  const turns: _ExportTurn[] = [];

  for (const [messageIndex, message] of conversation.messages.entries()) {
    const blocks: _ExportBlock[] = [];
    const citations: Immutable<DVoidWebCitation>[] = [];
    const imageFileStem = () => `${String(messageIndex + 1).padStart(3, '0')}-${blocks.filter(b => b.bt === 'image').length + 1}`;

    for (const fragment of message.fragments) {
      try {
        await _lowerFragment(fragment, blocks, citations, includeImages, imageFileStem);
      } catch (error) {
        console.warn('[ClaudeCodeExport] fragment not exported:', fragment, error);
        blocks.push({ bt: 'text', text: `[${('part' in fragment && fragment.part?.pt) || fragment.ft} not exported]` });
      }
    }

    if (citations.length) {
      const uniqueCitations = citations.filter((citation, index) => citations.findIndex(c => c.url === citation.url) === index);
      blocks.push({ bt: 'text', text: 'Sources:\n' + uniqueCitations.map((c, i) => `${c.refNumber ?? i + 1}. [${c.title || c.url}](${c.url})`).join('\n') });
    }

    // flags read as strings: newer app versions add flags (e.g. 'render.note')
    const userFlags: readonly string[] = message.userFlags ?? [];
    turns.push({
      message,
      skipped: userFlags.includes('aix.skip'),
      isNote: userFlags.includes('render.note'),
      modelLabel: message.role === 'assistant' && message.generator?.name ? prettyShortChatModelName(message.generator.name) : undefined,
      blocks,
    });
  }

  return turns;
}

async function _lowerFragment(fragment: Immutable<DMessageFragment>, blocks: _ExportBlock[], citations: Immutable<DVoidWebCitation>[], includeImages: boolean, imageFileStem: () => string): Promise<void> {

  // reasoning and placeholders are not exported, citations become a sources list
  if (fragment.ft === 'void') {
    if (fragment.part.pt === 'annotations')
      citations.push(...fragment.part.annotations);
    return;
  }
  if (fragment.ft !== 'content' && fragment.ft !== 'attachment')
    return;

  const part = fragment.part;
  switch (part.pt) {
    case 'text':
      if (part.text.trim())
        blocks.push({ bt: 'text', text: part.text });
      break;

    case 'error':
      blocks.push({ bt: 'text', text: `[ERROR] ${part.error}` });
      break;

    case 'doc':
      blocks.push({
        bt: 'doc',
        title: fragment.ft === 'attachment' ? attachmentFragmentDocTitle(fragment) : part.l1Title,
        ref: part.ref,
        text: part.data.text,
        language: part.meta?.codeLanguage,
      });
      break;

    case 'image_ref':
      blocks.push(await _lowerImage(part, includeImages, imageFileStem()));
      break;

    case 'reference':
      if (isZyncAssetImageReferencePart(part))
        blocks.push(await _lowerImage(part, includeImages, imageFileStem()));
      else if (isZyncAssetReferencePart(part))
        blocks.push({ bt: 'text', text: `[${part.assetType} not exported]` });
      break;

    case 'tool_invocation':
      const invocation = part.invocation;
      blocks.push({
        bt: 'text', text: invocation.type === 'function_call'
          ? `[Tool call: ${invocation.name}]\n${_fence(_prettyJson(invocation.args), 'json')}`
          : `[Code execution: ${invocation.language}]\n${_fence(invocation.code, invocation.language?.toLowerCase())}`,
      });
      break;

    case 'tool_response':
      const label = part.response.type === 'function_call' ? `Tool result: ${part.response.name}` : 'Code execution result';
      const errorNote = typeof part.error === 'string' ? ` - error: ${part.error}` : part.error ? ' - error' : '';
      blocks.push({ bt: 'text', text: `[${label}${errorNote}]\n${_fence(part.response.result)}` });
      break;

    case 'hosted_resource':
      const resource = part.resource;
      blocks.push({
        bt: 'text', text: resource.via === 'url' ? `[Video: ${resource.url}]`
          : `[Hosted file not exported: ${resource.via === 'anthropic' ? resource.fileId : resource.via === 'gemini-file' ? resource.fileName : resource.filename || resource.fileId}]`,
      });
      break;

    case '_pt_sentinel':
      break;

    default:
      // part types from newer app versions: keep a trace instead of dropping silently
      const unknownPart: { pt?: string } = part;
      blocks.push({ bt: 'text', text: `[${unknownPart.pt} not exported]` });
      break;
  }
}

async function _lowerImage(part: Immutable<DMessageImageRefPart | DMessageZyncAssetReferencePart>, includeImages: boolean, fileStem: string): Promise<_ExportBlock> {
  const altText = (part.pt === 'image_ref' ? part.altText : part.zRefSummary?.text || part._legacyImageRefPart?.altText) || 'image';
  if (!includeImages)
    return { bt: 'text', text: `[Image not exported: ${altText}]` };
  try {
    // the bytes the chat sends to models (wire-compatible formats)
    const inlineImage = part.pt === 'image_ref'
      ? await aixConvertImageRefToInlineImageOrThrow(part, false)
      : await aixConvertZyncImageAssetRefToInlineImageOrThrow(part, false);
    return { bt: 'image', mimeType: inlineImage.mimeType, base64: inlineImage.base64, fileName: `${fileStem}.${_imageExtension(inlineImage.mimeType)}`, altText };
  } catch {
    return { bt: 'text', text: `[Image not available on this device: ${altText}]` };
  }
}


/// Session rendering: one JSON line per turn, linked by parentUuid, then the title

type _SessionBlock =
  | { type: 'text', text: string }
  | { type: 'image', source: { type: 'base64', media_type: string, data: string } };

function _renderSessionJsonl(conversation: Immutable<DConversation>, title: string, turns: _ExportTurn[], includeSystemPrompt: boolean): string {

  // user/assistant turns, merging consecutive same-role turns
  const wireTurns: { role: 'user' | 'assistant', time: number | undefined, content: _SessionBlock[] }[] = [];
  const appendTurn = (role: 'user' | 'assistant', time: number | undefined, content: _SessionBlock[]) => {
    if (!content.length) return;
    const last = wireTurns[wireTurns.length - 1];
    if (last?.role === role) last.content.push(...content);
    else wireTurns.push({ role, time, content });
  };

  // preamble: provenance, models, and the original system prompt
  const modelLabels = [...new Set(turns.filter(t => !t.skipped && t.modelLabel).map(t => t.modelLabel))];
  let preamble = `[Chat exported from Big-AGI: "${title}", started ${_isoTime(conversation.created).slice(0, 10)}.${modelLabels.length ? ` Assistant replies came from: ${modelLabels.join(', ')}.` : ''}]`;
  if (includeSystemPrompt) {
    const systemPrompt = turns.filter(t => t.message.role === 'system').map(t => _messageText(t.message)).join('\n\n').trim();
    if (systemPrompt)
      preamble += `\n\nSystem prompt of the original chat:\n<system_prompt>\n${systemPrompt}\n</system_prompt>`;
  }
  appendTurn('user', conversation.created, [{ type: 'text', text: preamble }]);

  for (const turn of turns) {
    const role = turn.message.role;
    if (turn.skipped || (role !== 'user' && role !== 'assistant')) continue;

    const content: _SessionBlock[] = [];
    const assistantImages: _SessionBlock[] = [];
    for (const block of turn.blocks) {
      if (block.bt === 'image') {
        const image: _SessionBlock = { type: 'image', source: { type: 'base64', media_type: block.mimeType, data: block.base64 } };
        (role === 'user' ? content : assistantImages).push(image);
      } else
        content.push({ type: 'text', text: block.bt === 'doc' ? _fence(block.text, block.ref) : block.text });
    }
    appendTurn(role, turn.message.created, content);

    // the Messages API takes images from the user only: carry assistant-generated images in the next user turn
    if (assistantImages.length)
      appendTurn('user', turn.message.created, [{ type: 'text', text: '[Images generated by the assistant in the previous turn]' }, ...assistantImages]);
  }

  // transcript lines
  const sessionId = _uuidV4();
  const lines: object[] = [];
  let parentUuid: string | null = null;
  for (const wireTurn of wireTurns) {
    const uuid = _uuidV4();
    const envelope = { parentUuid, isSidechain: false, userType: 'external', cwd: CC_CWD, sessionId, version: CC_VERSION, uuid, timestamp: _isoTime(wireTurn.time ?? conversation.created) };
    lines.push(wireTurn.role === 'user'
      ? { ...envelope, type: 'user', message: { role: 'user', content: wireTurn.content } }
      : {
        ...envelope, type: 'assistant', message: {
          id: _uuidV4(), type: 'message', role: 'assistant', model: CC_ASSISTANT_MODEL, content: wireTurn.content,
          stop_reason: 'end_turn', stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
        },
      });
    parentUuid = uuid;
  }

  // the resume picker reads the title from the end of the file
  lines.push({ type: 'custom-title', customTitle: title, sessionId });

  return lines.map(line => JSON.stringify(line)).join('\n') + '\n';
}


/// Markdown rendering (chat.md): front matter, then one section per message

function _renderChatMarkdown(conversation: Immutable<DConversation>, title: string, turns: _ExportTurn[], includeSystemPrompt: boolean): string {
  const modelLabels = [...new Set(turns.filter(t => t.modelLabel).map(t => t.modelLabel))];
  const frontMatter = [
    '---',
    `schema: ${FOLDER_SCHEMA}`,
    `schemaVersion: ${FOLDER_SCHEMA_VERSION}`,
    `title: ${JSON.stringify(title)}`,
    `id: ${JSON.stringify(conversation.id)}`,
    `created: ${_isoTime(conversation.created)}`,
    ...(conversation.updated ? [`updated: ${_isoTime(conversation.updated)}`] : []),
    `models: ${JSON.stringify(modelLabels)}`,
    `messages: ${turns.filter(t => t.message.role !== 'system').length}`,
    'source: Big-AGI',
    '---',
  ].join('\n');

  const sections = [frontMatter, `# ${title}`];
  for (const turn of turns) {
    const role = turn.message.role;
    if (role === 'system' && !includeSystemPrompt) continue;
    const heading = turn.isNote ? 'Note'
      : role === 'system' ? 'System prompt'
        : role === 'user' ? 'User'
          : `Assistant${turn.modelLabel ? ` · ${turn.modelLabel}` : ''}`;
    const body = turn.blocks.map(block => {
      switch (block.bt) {
        case 'text':
          return block.text;
        case 'doc':
          return `**Attachment: ${block.title}**\n\n${_fence(block.text, block.language)}`;
        case 'image':
          return `![${block.altText.replace(/[[\]\n]/g, ' ')}](images/${block.fileName})`;
      }
    }).join('\n\n');
    const contextNote = turn.skipped && !turn.isNote ? ' (excluded from AI context)' : '';
    sections.push(`## ${heading}${contextNote}\n<!-- message ${turn.message.id}, ${_isoTime(turn.message.created)} -->\n\n${body}`);
  }

  return sections.join('\n\n') + '\n';
}


/// Helpers

/** Stable per-chat name, so that re-exports land in the same folder: 'YYYY-MM-DD-title-slug-id8' (creation date) */
function _folderName(conversation: Immutable<DConversation>): string {
  const created = new Date(conversation.created);
  const date = isNaN(created.getTime()) ? 'undated'
    : `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}-${String(created.getDate()).padStart(2, '0')}`;
  const titleSlug = _fileSlug(conversation.userTitle || conversation.autoTitle || '') || 'untitled';
  const id8 = String(conversation.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toLowerCase();
  return `${date}-${titleSlug}-${id8}`;
}

/** Lowercase ASCII slug, clipped at a word boundary */
function _fileSlug(text: string): string {
  const slug = text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= FOLDER_TITLE_MAX_CHARS) return slug;
  const clipped = slug.slice(0, FOLDER_TITLE_MAX_CHARS);
  const lastDash = clipped.lastIndexOf('-');
  return (lastDash >= FOLDER_TITLE_MAX_CHARS / 2 ? clipped.slice(0, lastDash) : clipped).replace(/-+$/, '');
}

function _conversationAtRest(conversation: Immutable<DConversation>): object {
  return Object.fromEntries(Object.entries(conversation).filter(([key, value]) => CHAT_JSON_FIELDS.includes(key) && value !== undefined));
}

function _messageText(message: Immutable<DMessage>): string {
  return message.fragments.map(fragment => fragment.ft === 'content' && fragment.part?.pt === 'text' ? fragment.part.text : '').filter(Boolean).join('\n\n');
}

/** Fenced block that survives backtick runs inside the text */
function _fence(text: string, info: string = ''): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) || []).map(run => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return `${fence}${info}\n${text}\n${fence}`;
}

function _prettyJson(json: string | null | undefined): string {
  if (!json) return '{}';
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function _imageExtension(mimeType: string): string {
  const subtype = mimeType.split('/')[1] || 'png';
  return subtype === 'jpeg' ? 'jpg' : subtype;
}

/** ISO time, tolerant of missing or invalid stamps in old data */
function _isoTime(time: number | null | undefined): string {
  const date = new Date(time ?? Date.now());
  return (isNaN(date.getTime()) ? new Date() : date).toISOString();
}

/** UUID v4 - crypto.randomUUID is missing on plain-http hosts, getRandomValues is not */
function _uuidV4(): string {
  if (typeof crypto.randomUUID === 'function')
    return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
