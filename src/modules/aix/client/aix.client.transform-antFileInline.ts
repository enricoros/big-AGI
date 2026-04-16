import { apiAsync } from '~/common/util/trpc.client';
import { convert_Base64_To_UInt8Array } from '~/common/util/blobUtils';

import type { AixAPI_Access, AixWire_Particles } from '../server/api/aix.wiretypes';

import type { ReassemblerParticleTransforms } from './ContentReassembler';


// configuration - matching the server-side transform (anthropic.transform-fileInline.ts)
const INLINE_TEXT_MAX_BYTES = 256 * 1024; // 256 KB
const INLINE_IMAGE_MAX_BYTES = 1024 * 1024; // 1 MB
const INLINE_IMAGE_SKIP_RESIZE_BELOW_BYTES = 500 * 1024; // 500 KB

// Equal to `_isInlineableTextMimeType` in anthropic.transform-fileInline.ts.
function _isInlineableTextMime(mimeType: string): boolean {
  const type = mimeType.split(';')[0].trim().toLowerCase();
  if (type.startsWith('text/')) return true;
  if (type.startsWith('application/')) {
    const sub = type.slice('application/'.length);
    if (sub.endsWith('+json') || sub.endsWith('+xml') || sub.endsWith('+yaml')) return true;
    return ['json', 'xml', 'yaml', 'toml', 'javascript', 'typescript', 'ecmascript',
      'sql', 'graphql', 'ld+json', 'x-yaml', 'x-toml', 'x-sh', 'x-python', 'x-perl',
      'x-ruby', 'x-www-form-urlencoded', 'x-httpd-php', 'x-tex', 'x-latex'].includes(sub);
  }
  return false;
}

// Equal to `_isInlineableImageMimeType` in anthropic.transform-fileInline.ts.
function _isInlineableImageMimeType(mimeType: string): boolean {
  const type = mimeType.split(';')[0].trim().toLowerCase();
  return ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(type);
}



/**
 * Client-side Anthropic file inline transform - counterpart of the server-side
 * `createAnthropicFileInlineTransform` in anthropic.transform-fileInline.ts.
 *
 * The server-side transform fetches files directly from the Anthropic File API using native fetch.
 * This works in Edge Runtime but NOT in the browser (CSF mode) because Anthropic's File API
 * blocks CORS. The server-side transform tags itself `csfUnsafe` and gets stripped at the CSF
 * boundary (aix.client.direct-chatGenerate.ts).
 *
 * This client-side transform fills the gap: it fetches files via tRPC endpoints that are always
 * proxied through the real server, bypassing CORS. It returns replacement particles ({t:...} for
 * text, {p:'ii',...} for images) that the reassembler processes through its normal handlers.
 */
export function createClientAnthropicFileInlineTransform(
  access: Extract<AixAPI_Access, { dialect: 'anthropic' }>,
  deleteAfterInline: boolean,
): ReassemblerParticleTransforms {

  return {

    shallTransform(particle: AixWire_Particles.ChatGenerateOp): boolean {
      return 'p' in particle && particle.p === 'hres' && particle.kind === 'vnd.ant.file';
    },

    async transform(particle: AixWire_Particles.ChatGenerateOp): Promise<AixWire_Particles.ChatGenerateOp | null> {
      if (!('p' in particle) || particle.p !== 'hres' || particle.kind !== 'vnd.ant.file')
        return null; // type guard

      const { fileId } = particle;

      // 1. Fetch metadata via tRPC (proxied through server - bypasses CORS)
      const { filename, mime_type: mimeType, size_bytes, downloadable } = await apiAsync.llmAnthropic.fileApiGetMetadata.query({ access, fileId });
      if (!downloadable) return null;

      const isText = _isInlineableTextMime(mimeType);
      const isImage = !isText && _isInlineableImageMimeType(mimeType);
      if (!isText && !isImage) return null;

      const sizeCap = isText ? INLINE_TEXT_MAX_BYTES : INLINE_IMAGE_MAX_BYTES;
      if (size_bytes !== undefined && size_bytes > sizeCap) return null;

      // 2. Fetch content via tRPC (proxied through server - bypasses CORS)
      const { base64Data, mimeType: httpMime } = await apiAsync.llmAnthropic.fileApiDownload.query({ access, fileId });

      let resultParticle: AixWire_Particles.ChatGenerateOp;

      if (isText) {

        // decode base64 -> UTF-8 text
        const bytes = convert_Base64_To_UInt8Array(base64Data, 'aix-file-inline-text');
        const text = new TextDecoder().decode(bytes);
        if (text.length > INLINE_TEXT_MAX_BYTES) return null;

        // build fenced text with adaptive fence depth (matching server-side logic)
        let fence = '```';
        while (text.includes(fence) && fence.length < 10) fence += '`';

        // leading double-newline to break from prior text, matching server-side transform
        resultParticle = { t: `\n\n${fence}${filename}\n${text}\n${fence}\n` };

      } else {

        // Image: build inline image particle
        resultParticle = {
          p: 'ii',  // inline image
          mimeType,
          i_b64: base64Data,
          ...(filename ? { label: filename } : {}),
          generator: `Anthropic File ${fileId}`,
          ...(size_bytes < INLINE_IMAGE_SKIP_RESIZE_BELOW_BYTES ? {
            hintSkipResize: true,
          } : {}),
        };

      }

      // 3. Fire-and-forget delete if policy requires
      if (deleteAfterInline)
        apiAsync.llmAnthropic.fileApiDelete.mutate({ access: access as any, fileId })
          .catch(error => console.log('[AIX] CSF file inline: failed to delete file after inlining:', { fileId, error }));

      return resultParticle;
    },

  };
}
