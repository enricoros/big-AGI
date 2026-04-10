import { fetchJsonOrTRPCThrow, fetchResponseOrTRPCThrow, fetchTextOrTRPCThrow } from '~/server/trpc/trpc.router.fetchers';

import { anthropicAccess } from '~/modules/llms/server/anthropic/anthropic.access';

import type { ChatGenerateParticleTransformFunction } from '../chatGenerate.dispatch';
import { FileMetadataResponse_schema } from '~/modules/llms/server/llm.server.types';


// configuration
const INLINE_TEXT_MAX_BYTES = 256 * 1024; // 256 KB - text-content cap; above this, the file stays as a hosted resource link
const INLINE_IMAGE_MAX_BYTES = 1024 * 1024; // 1 MB - image-binary cap; ~1.33 MB after base64 expansion
const INLINE_IMAGE_PRESERVE_QUALITY_BELOW_BYTES = 500 * 1024; // 500 KB - below this, hint reassembler to skip resize/recompress

const _INLINEABLE_APPLICATION_SUBTYPES = new Set([
  // known textual application/* subtypes - keep the list small and focused on common text/code formats
  'json', 'xml', 'yaml', 'toml',
  'javascript', 'typescript', 'ecmascript',
  'sql', 'graphql', 'ld+json',
  'x-yaml', 'x-toml', 'x-sh', 'x-python', 'x-perl', 'x-ruby',
  'x-www-form-urlencoded', 'x-httpd-php', 'x-tex', 'x-latex',
]);

const _INLINEABLE_IMAGE_MIME_TYPES = new Set([
  // common raster formats - intentionally NO image/svg+xml (XSS risk: can contain <script>)
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
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

/** Allowlist of inline-able image mime types. SVG is intentionally excluded (XSS risk). */
function _isInlineableImageMimeType(mimeType: string): boolean {
  const type = mimeType.split(';')[0].trim().toLowerCase();
  return _INLINEABLE_IMAGE_MIME_TYPES.has(type);
}

/**
 * Anthropic file inline particle transform. Container File reference -> inline content.
 *
 * Intercepts hosted-resource particles ({ p: 'hres', kind: 'vnd.ant.file' }) emitted by
 * the Anthropic parser, fetches the file metadata + content via native fetch (works in
 * Edge Runtime AND browser/CSF), and replaces them with either:
 *  - a TEXT particle ({ t: ... }) with fenced content, for textual MIME types
 *  - an INLINE IMAGE particle ({ p: 'ii', ... }) with base64 bytes, for image/* MIME types
 *
 * Returns the original particle for any explicit "not inlineable" decision (non-OK response,
 * unsupported MIME, oversized, ...). Any thrown error is caught by the executor's transform
 * safety net, which falls back to the original particle.
 *
 * NOTES:
 *  - Text branch: the replacement text particle accumulates into the surrounding text fragment
 *    in the reassembler. Visual rendering is correct via markdown fences, but the data model
 *    loses the explicit fragment boundary.
 *  - Image branch: the 'ii' particle creates a CLEAN, non-fusing fragment in the reassembler
 *    (it explicitly resets text accumulation), so images are atomic in the data model.
 */
export function createAnthropicFileInlineTransform(fileApiRequest: ReturnType<typeof anthropicAccess>, deleteAfterInline: boolean): ChatGenerateParticleTransformFunction {

  return async (particle) => {
    // pass-through any non-Anthropic-file particle
    if (!('p' in particle) || particle.p !== 'hres' || particle.kind !== 'vnd.ant.file')
      return particle;


    const fileId = particle.fileId; // capture before particle is potentially reassigned to a replacement
    const fileUrl = `${fileApiRequest.url}/${fileId}`;
    const headers = fileApiRequest.headers;

    // 1. Fetch metadata to check MIME type and size
    //    Errors (connection, 4xx/5xx, JSON parse) throw; the executor's transform safety net falls back to the original particle.
    const { filename, mime_type: mimeType, size_bytes, downloadable } = FileMetadataResponse_schema.parse(await fetchJsonOrTRPCThrow({ url: fileUrl, headers, name: 'Anthropic.fileInline.meta', throwWithoutName: true }));
    if (!downloadable) return particle;

    // only Text / Images
    const isText = _isInlineableTextMimeType(mimeType);
    const isImage = !isText && _isInlineableImageMimeType(mimeType);
    if (!isText && !isImage) return particle;

    // only below a Size cap
    const sizeCap = isText ? INLINE_TEXT_MAX_BYTES : INLINE_IMAGE_MAX_BYTES;
    if (size_bytes !== undefined && size_bytes > sizeCap) return particle;


    if (isText) {

      // 2. Text path: fetch as string
      const text = await fetchTextOrTRPCThrow({ url: `${fileUrl}/content`, headers, name: 'Anthropic.fileInline.text', throwWithoutName: true });
      if (text.length > INLINE_TEXT_MAX_BYTES) return particle;

      // 3. particle with adaptive fence depth (extra backticks if content contains ```)
      let fence = '```';
      while (text.includes(fence) && fence.length < 10)
        fence += '`';

      // NOTE: leading double-newline is because we are likely attaching this to a text fragment, so we have to at least break there
      particle = { t: '\n\n' + `${fence}${filename}\n${text}\n${fence}\n` };

    } else {

      // 2. Image path: fetch as bytes, encode base64, build inline image particle
      const imageResponse = await fetchResponseOrTRPCThrow({ url: `${fileUrl}/content`, headers, name: 'Anthropic.fileInline.image', throwWithoutName: true });
      const imageBuffer = await imageResponse.arrayBuffer();
      if (imageBuffer.byteLength > INLINE_IMAGE_MAX_BYTES) return particle; // defensive size guard

      // 3. particle
      particle = {
        p: 'ii',  // inline image
        mimeType,
        i_b64: Buffer.from(imageBuffer).toString('base64'),
        ...(filename ? { label: filename } : {}),
        generator: `Anthropic File ${fileId}`,
        // small images: hint reassembler to skip the PNG->WebP recompression and preserve original quality
        ...(imageBuffer.byteLength < INLINE_IMAGE_PRESERVE_QUALITY_BELOW_BYTES ? {
          hintSkipResize: true,
        } : {}),
      };

    }

    // 4. Fire-and-forget delete if policy requires (raw fetch - we don't care about result/errors)
    if (deleteAfterInline)
      fetchResponseOrTRPCThrow({ url: fileUrl, headers, method: 'DELETE', name: 'Anthropic.fileInline.delete', throwWithoutName: true }).catch(error => console.log(`[AnthropicFileInlineTransform] Failed to delete file ${fileId} after inlining:`, { error }));

    return particle;
  };
}
