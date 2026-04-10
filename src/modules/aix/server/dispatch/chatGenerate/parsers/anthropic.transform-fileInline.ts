import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow, fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.access';

import type { ChatGenerateParticleTransformFunction } from '../chatGenerate.dispatch';
import { FileMetadataResponse_schema } from '~/modules/llms/server/llm.server.types';


// configuration
const INLINE_MAX_BYTES = 256 * 1024; // 256 KB - message blowup prevention; above this, the file stays as a hosted resource link
const _INLINEABLE_APPLICATION_SUBTYPES = new Set([
  // known textual application/* subtypes - keep the list small and focused on common text/code formats
  'json', 'xml', 'yaml', 'toml',
  'javascript', 'typescript', 'ecmascript',
  'sql', 'graphql', 'ld+json',
  'x-yaml', 'x-toml', 'x-sh', 'x-python', 'x-perl', 'x-ruby',
  'x-www-form-urlencoded', 'x-httpd-php', 'x-tex', 'x-latex',
]);

/**
 * Rules for determining a 'textual' mimetype to be downloaded:
 *
 * 1. text/*  - the whole text family (text/plain, text/csv, text/html, text/markdown, ...)
 * 2. application/*  with structured suffix +json | +xml | +yaml (RFC 6839) - e.g. application/vnd.api+json, application/atom+xml
 * 3. application/*  in a small allowlist of known textual subtypes (json, xml, yaml, sql, ...)
 *
 * Rejects: image/*, audio/*, video/*, application/pdf, application/octet-stream, etc.
 */
function _isInlineableTextMimeType(mimeType: string): boolean {

  // strip parameters: 'text/plain; charset=utf-8' -> text/plain
  const type = mimeType.split(';')[0].trim().toLowerCase();

  // allow: text/*
  if (type.startsWith('text/')) return true;

  // application/*: allow certain suffixes and known subtypes
  if (type.startsWith('application/')) {
    const subtype = type.slice('application/'.length);
    // structured suffix (RFC 6839): +json, +xml, +yaml
    if (subtype.endsWith('+json') || subtype.endsWith('+xml') || subtype.endsWith('+yaml')) return true;
    // known text subtypes
    return _INLINEABLE_APPLICATION_SUBTYPES.has(subtype);
  }

  // reject
  return false;
}

/**
 * Anthropic file inline particle transform. Container File reference -> inline Text content.
 *
 * Intercepts hosted-resource particles ({ p: 'hres', kind: 'vnd.ant.file' }) emitted by
 * the Anthropic parser, fetches the file metadata + content via native fetch (works in
 * Edge Runtime AND browser/CSF), and replaces them with a text particle containing the
 * fenced file content. Returns the original particle for any explicit "not inlineable"
 * decision (non-OK response, non-text MIME, oversized, ...). Any thrown error is caught
 * by the executor's transform safety net, which falls back to the original particle.
 *
 * CHANGE OF BEHAVIOR: withtout the transform we have [T, HRES, T], while with the transform
 * we have [T + fileContent + T].
 *
 * The replacement text particle accumulates into the surrounding text fragment in the reassembler
 * (since it's a regular incremental text particle). The visual renderingis correct (markdown
 * handles the fence boundaries), but the data model loses the explicit fragment boundary.
 */
export function createAnthropicFileInlineTransform(fileApiRequest: ReturnType<typeof anthropicAccess>, deleteAfterInline: boolean): ChatGenerateParticleTransformFunction {

  return async (particle) => {
    // pass-through any non-Anthropic-file particle
    if (!('p' in particle) || particle.p !== 'hres' || particle.kind !== 'vnd.ant.file')
      return particle;

    const fileUrl = `${fileApiRequest.url}/${particle.fileId}`;
    const headers = fileApiRequest.headers;

    // 1. Fetch metadata to check MIME type and size
    //    Errors (connection, 4xx/5xx, JSON parse) throw; the executor's transform safety net falls back to the original particle.
    const metadata = FileMetadataResponse_schema.parse(await fetchJsonOrTRPCThrow({ url: fileUrl, headers, name: 'Anthropic.fileInline.meta', throwWithoutName: true }));
    if (!_isInlineableTextMimeType(metadata.mime_type)) return particle; // non-text, keep hosted resource
    if (metadata.size_bytes !== undefined && metadata.size_bytes > INLINE_MAX_BYTES) return particle; // too large, keep hosted resource

    // 2. Fetch file content as text
    const text = await fetchTextOrTRPCThrow({ url: `${fileUrl}/content`, headers, name: 'Anthropic.fileInline.read', throwWithoutName: true });
    if (text.length > INLINE_MAX_BYTES) return particle;

    // 3. Adaptive fence depth (extra backticks if content contains ```)
    let fence = '```';
    while (text.includes(fence) && fence.length < 10)
      fence += '`';

    // 4. Fire-and-forget delete if policy requires (raw fetch - we don't care about result/errors)
    if (deleteAfterInline)
      fetchResponseOrTRPCThrow({ url: fileUrl, headers, method: 'DELETE', name: 'Anthropic.fileInline.delete', throwWithoutName: true }).catch(error => console.log(`[AnthropicFileInlineTransform] Failed to delete file ${particle.fileId} after inlining:`, { error }));

    // 5. Emit as a text particle with fenced content
    // NOTE: leading doubl-newline is because we are likely attaching this to a text fragment, so we have to at least break there.
    return { t: '\n\n' + `${fence}${metadata.filename}\n${text}\n${fence}\n` };
  };
}
